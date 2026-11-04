# JMGO ShapesFX / MusicFX

The five presets use two original source meshes, all five UV channels, original
normals, five source textures, material values and shader computations. Source
sampler wrap, bilinear/mipmap filtering, depth test/write and backface culling are
retained. The GLSL uses the shipped shader's non-UBO/non-explicit-location branches.
Main-function hashes are stored alongside full source-stage hashes. No generated
replacement sphere/cube geometry or invented outline shader is used.

Run `python3 scripts/export-jmgo-shapes.py /path/to/Arwen.apk` from the repository
root to reproduce the export. The APK bundle is verified byte for byte.

Source constraints and explicit demo decisions:

- All five shape objects are inactive in the prefab. A native ShapesFXLRC
  controller selects them at runtime, but its selection cadence is not recovered.
  The demo defaults to M_Hi_Cube_00 to distinguish it from ElantraBall. `render({shapeVariant:0..4})` selects a source
  preset, while explicit `shapeVariant:'auto'` previews one preset every 12 seconds.
- ShapesFXSetting supplies NormalPush/Shrink ranges and a 0.2-second interpolation
  constant. The demo maps `clamp(.7*low+.3*mid)` to those ranges. This is an audio
  adapter, not recovered native FFT normalization. Serialized AnimationSpeed flags
  are false, so source material animation speeds remain unchanged.
- The source Rotator has speed 30 and direction (1,.2,.1). Its native integration
  order/rotation space are unresolved; the demo uses time-derived Euler YXZ so
  pause and seeking are repeatable.
- This bundle contains no camera profile. The inferred demo camera uses FOV 60
  and fits each preset's original undeformed vertical extent near 40% of the
  frame. It retreats only when the current source shader deformation envelope
  would exceed 90% of the frame. This preserves the original object scales and
  material parameters while avoiding clipping at stronger inputs. The envelope
  is computed from every original vertex at displacement-mask values 0 and 1;
  shader displacement is affine in that mask, so these endpoints enclose every
  intermediate texture sample. The original camera placement remains unresolved.
- No text/TMP component exists here, so `scene.lyrics.hidden` is true. The transparent
  RawImage shadow has no assigned texture in the source and is not fabricated.
- Gamma is the default, with an optional Linear/sRGB comparison. Original player
  color configuration and same-song original-device comparison remain unresolved.
