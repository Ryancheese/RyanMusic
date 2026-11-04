# JMGO Matrix

This scene uses all 24 original meshes, UV1, vertex colors, normals and source
hierarchy transforms. It preserves the original camera (Y=1, Z=-10, FOV=36),
16 material/keyword combinations and both eight-variant GLES3 shader families.
Opaque Matrix03 geometry draws first; MatrixLight01 retains source alpha blending,
depth-write-off and backface culling. Three.js supplies matrix math only.

Run `python3 scripts/export-jmgo-matrix.py /path/to/Arwen.apk` from the repository
root to reproduce the asset export. The script verifies bundle bytes against the
APK and writes hashes, serialized settings and original shader exports.

The programs use `MatrixAudio[17]`. Shader indexing establishes eight amplitudes,
an overall normal displacement and eight segment-activation counters. The native
normalization and smoothing have not been recovered. The renderer therefore maps
eight host bands to those slots, using `ceil(6 * amplitude)` for segment counters.
Callers can supply a complete `matrixAudio` array if the original runtime algorithm
is later recovered. No invented time rotation or random geometry is added.

The source disables postprocessing; no extra bloom is introduced. Gamma is the
demo default, while optional Linear mode decodes color uniforms and encodes the
final output. The original player color-space setting and same-song projector
reference remain unresolved. TextMeshPro text is rendered by the host DOM layer.
