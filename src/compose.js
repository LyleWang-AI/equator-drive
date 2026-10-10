// 全屏合成：在成片上乘一层近处的接触阴影
window.ED = window.ED || {};

(function (ED) {
  const FRAG = `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform vec2 resolution;
    uniform mat4 projection;
    uniform mat4 inverseProjection;
    varying vec2 vUv;
    float perspectiveDepthToViewZ(float depth, float near, float far) {
      return (near * far) / ((far - near) * depth - far);
    }
    vec3 viewPos(vec2 uv) {
      float depth = texture2D(tDepth, uv).x;
      float viewZ = perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
      float clipW = projection[2][3] * viewZ + projection[3][3];
      vec4 clip = vec4((vec3(uv, depth) - 0.5) * 2.0, 1.0);
      clip *= clipW;
      return (inverseProjection * clip).xyz;
    }
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec3 p = viewPos(vUv);
      float viewZ = p.z;
      float loss = 0.0;
      vec2 px = 22.0 / resolution;
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 2.399963;
        float radius = 0.35 + float(i) * 0.12;
        vec2 off = vec2(cos(a), sin(a)) * radius * px;
        float dz = viewPos(vUv + off).z - viewZ;
        if (dz > 0.05 && dz < 2.4) loss += 1.0 - dz / 2.4;
      }
      float ao = clamp(1.0 - loss * 0.055, 0.84, 1.0);
      float nearK = smoothstep(-120.0, -18.0, viewZ);
      ao = mix(1.0, ao, nearK);
      gl_FragColor = vec4(color.rgb * ao, color.a);
    }
  `;

  class Composer {
    constructor(renderer) {
      this.renderer = renderer;
      const depth = new THREE.DepthTexture(4, 4);
      depth.format = THREE.DepthFormat;
      depth.type = THREE.UnsignedIntType;
      this.target = new THREE.WebGLRenderTarget(4, 4, { depthTexture: depth });
      this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
      this.cam.position.z = 1;
      this.material = new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: null },
          tDepth: { value: null },
          cameraNear: { value: 0.3 },
          cameraFar: { value: 6000 },
          resolution: { value: new THREE.Vector2(4, 4) },
          projection: { value: new THREE.Matrix4() },
          inverseProjection: { value: new THREE.Matrix4() },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }`,
        fragmentShader: FRAG,
        depthTest: false,
        depthWrite: false,
      });
      const scene = new THREE.Scene();
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
      this.scene = scene;
      this.setSize(renderer.domElement.width || 4, renderer.domElement.height || 4);
    }

    setSize(w, h) {
      const rw = Math.max(2, w | 0);
      const rh = Math.max(2, h | 0);
      this.target.setSize(rw, rh);
      this.material.uniforms.resolution.value.set(rw, rh);
    }

    render(scene, camera) {
      const r = this.renderer;
      const u = this.material.uniforms;
      r.setRenderTarget(this.target);
      r.render(scene, camera);
      r.setRenderTarget(null);
      u.tDiffuse.value = this.target.texture;
      u.tDepth.value = this.target.depthTexture;
      u.cameraNear.value = camera.near;
      u.cameraFar.value = camera.far;
      u.projection.value.copy(camera.projectionMatrix);
      u.inverseProjection.value.copy(camera.projectionMatrixInverse);
      r.render(this.scene, this.cam);
    }
  }

  ED.Composer = Composer;
})(window.ED);
