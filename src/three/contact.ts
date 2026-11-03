// Contact-hardening shadows for the WebGL driver (D15): a shadow is sharp and dark where the
// caster meets the surface and softens and pales with the gap between them, the way a flap's
// shadow is a crisp line at its crease and a soft wash under its lifted edge. Percentage-closer
// soft shadows (Fernando, "Percentage-Closer Soft Shadows", NVIDIA 2005, the method of three.js's
// webgl_shadowmap_pcss example): per fragment, a blocker search in the depth map gives the mean
// distance to what shades it, and the filter radius follows that distance by `penumbra()`, the
// law the CSS driver uses. It replaces the body of three's basic (unfiltered) `getShadow` in the
// materials that receive (the floor and the root face), so the shadow map stays a plain depth
// map and nothing else in the scene changes.
import { ShaderChunk, type Material, type WebGLProgramParametersWithUniforms } from 'three'
import type { Style } from '../core/style.ts'

/** The per-frame values the patched shader reads; one set per stage, shared by every receiving material. */
export interface ContactUniforms {
  /** Sheet px between the shadow camera's near and far planes: depth to distance. */
  oriShadowRange: { value: number }
  /** Sheet px per shadow-map texel. */
  oriShadowTexel: { value: number }
  /** The penumbra law (`penumbra()`): sigma at contact, sigma gained per px of gap, the blocker search radius in px. */
  oriShadowSoft: { value: [number, number, number] }
  /** The strength lost at 300 px of gap. */
  oriShadowFade: { value: number }
}

export function contactUniforms(style: Style): ContactUniforms {
  const c = style.shadows.contact, a = style.shadows.ambient
  return {
    oriShadowRange: { value: 1 },
    oriShadowTexel: { value: 1 },
    oriShadowSoft: { value: [c.blur / 2, a.lift.blur / 4, c.blur] },
    oriShadowFade: { value: a.lift.opacity },
  }
}

// The basic getShadow is the last one taking a sampler2D (the VSM one, before it, has the same
// signature); three's build minifies its shader text, so it is found by its signature, not by a
// comment or by spacing
const SIGNATURE = /float\s+getShadow\s*\(\s*sampler2D\s+shadowMap\b/g

const PCSS = /* glsl */ `uniform float oriShadowRange;
uniform float oriShadowTexel;
uniform vec3 oriShadowSoft;
uniform float oriShadowFade;
float oriNoise( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
vec2 oriDisk( int i, int n, float phi ) {
	float r = sqrt( ( float( i ) + 0.5 ) / float( n ) );
	float a = float( i ) * 2.399963229728653 + phi;
	return vec2( cos( a ), sin( a ) ) * r;
}
// Distance from the light, growing away from it, whatever the depth buffer's direction
float oriDepth( float d ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return 1.0 - d;
	#else
		return d;
	#endif
}
float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
	shadowCoord.xyz /= shadowCoord.w;
	#ifdef USE_REVERSED_DEPTH_BUFFER
		shadowCoord.z -= shadowBias;
	#else
		shadowCoord.z += shadowBias;
	#endif
	bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
	if ( ! ( inFrustum && shadowCoord.z <= 1.0 ) ) return 1.0;
	float zr = oriDepth( shadowCoord.z );
	vec2 texel = 1.0 / shadowMapSize;
	float phi = oriNoise( gl_FragCoord.xy ) * 6.2831853;
	// The blockers: the mean depth of what lies between this point and the light
	float searchR = max( 1.0, oriShadowSoft.z / oriShadowTexel );
	float sum = 0.0;
	float n = 0.0;
	for ( int i = 0; i < 16; i ++ ) {
		float d = oriDepth( texture2D( shadowMap, shadowCoord.xy + oriDisk( i, 16, phi ) * searchR * texel ).r );
		if ( d < zr ) { sum += d; n += 1.0; }
	}
	if ( n == 0.0 ) return 1.0;
	// The gap to them in sheet px sets the softness and the strength (penumbra())
	float gap = max( 0.0, zr - sum / n ) * oriShadowRange;
	float sigma = oriShadowSoft.x + oriShadowSoft.y * gap;
	float r = max( 1.0, 2.0 * sigma / oriShadowTexel );
	float lit = 0.0;
	for ( int i = 0; i < 32; i ++ ) {
		float d = oriDepth( texture2D( shadowMap, shadowCoord.xy + oriDisk( i, 32, phi + 1.7 ) * r * texel ).r );
		lit += step( zr, d );
	}
	lit /= 32.0;
	float strength = 1.0 - oriShadowFade * min( 1.0, gap / 300.0 );
	return mix( 1.0, lit, shadowIntensity * strength );
}`

/** three's shadow chunk with the basic getShadow replaced by the contact-hardening one; throws if this three's chunk no longer has the function to replace. */
export function contactChunk(chunk: string = ShaderChunk.shadowmap_pars_fragment): string {
  const found = [...chunk.matchAll(SIGNATURE)]
  const at = found.at(-1)?.index
  const open = at === undefined ? -1 : chunk.indexOf('{', at)
  if (at === undefined || found.length < 2 || open < 0) throw new Error('orkami: this three.js has no basic getShadow to replace; contact shadows need three 0.186')
  // The function's end: its braces balanced
  let depth = 0, end = open
  for (; end < chunk.length; end++) {
    if (chunk[end] === '{') depth++
    else if (chunk[end] === '}' && --depth === 0) break
  }
  return chunk.slice(0, at) + PCSS + chunk.slice(end + 1)
}

/** Makes a receiving material use the contact-hardening shadow, keeping any onBeforeCompile it already has. */
export function contactMaterial(material: Material, uniforms: ContactUniforms): void {
  if (material.userData.oriContact) return
  material.userData.oriContact = true
  const chunk = contactChunk()
  const before = material.onBeforeCompile
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    before.call(material, shader, renderer)
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader.replace('#include <shadowmap_pars_fragment>', chunk)
  }
  const key = material.customProgramCacheKey
  material.customProgramCacheKey = () => `${key.call(material)}|ori-contact`
  material.needsUpdate = true
}
