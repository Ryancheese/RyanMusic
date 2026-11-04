# JMGO VinylLRC

`Cover2D03` is the source prefab's serialized active layout, and is the renderer's
default. It uses five original SpriteRenderers and the original `MusicCover_BG`
mesh for the album image. Simple sprites retain the actual tight geometry and
UV transform; Sliced sprites use the original borders, pivot, pixels-to-units and
SpriteRenderer size. The original disc has 298 outline vertices. The full
orthographic camera (size 5, position 0/1/-10), hierarchy and depth ordering are
preserved. The default album image is the first of the source component's three
default covers, filling the otherwise runtime-empty cover material.

The bundle also contains a serialized inactive `MusicDefault` layout with three
meshes and custom vinyl/shadow shaders. Those meshes, shaders, material values,
textures and the `Play` clip are preserved in the export. This renderer renders
the active turntable layout; it does not silently activate the other layout.

The active album-image mesh uses the original URP Unlit Forward program, whose
vertex and fragment arithmetic are preserved. SpriteRenderer used the built-in
Sprites-Default shader; this wrapper implements its unlit texture × tint and
premultiplied-alpha presentation, while retaining original sprite resources.

## Animation evidence

`TurntableStart`, `TurntableStop`, `TurntableIdel`, and `Play` clips retain their
raw serialized records. The exporter decodes streamed frames into curve-indexed
cubic coefficients without resampling. CRC32 of `TurntableGan` matches binding
505688277. For Z rotation, Start is `60t³ − 90t²` (0 to -30 degrees), and Stop is
`-60t³ + 90t² − 30` (-30 to 0), over one second. Idle is constant zero.
The original `Turntable2D` animator state graph and 0.25-second transition values
are also retained. Demo play/pause selects the corresponding source clip and
blends interrupted changes over that recorded duration. Exact native parameter
updates and Unity transition blending remain unverified.

The source component's `_vinylRotationSpeed` is 6. The demo interprets that as
clockwise degrees per playback second, so pausing freezes the disc and seeking
sets a deterministic angle. Native direction and time basis remain unknown.

## Text/layout evidence

The renderer returns `overlay`, which the host should append to its relatively
positioned scene container. Generic lyrics are suppressed through
`scene.lyrics.hidden`. Source Light-font lyrics (size 66), title (80), and artist
(45) use the actual source Canvas scale and camera projection. Only metadata
supplied by the host is shown; the prefab's example track/artist are not reused.
No artist is displayed when it is unknown.

Lyric interpolation uses the serialized 0.6667-second movement duration, spacing
55, active-line scale 1.2, and upper/lower layout limits. DOM text approximates
TextMeshPro shaping and pooling; exact runtime layout overrides, masking and
alpha blending remain unresolved. The saved disabled graphic mask is not treated
as an active edge fade. No extra audio-driven deformation is invented
for this non-spectrum scene.

Re-export with UnityPy:

```sh
python3 scripts/export-jmgo-vinyl.py /tmp/jmgo-apks/Arwen.apk
```

`scene.json` keeps the full original layout and decoded curves. `provenance.json`
records bundle/APK hashes, program-body hashes, and the reconstruction boundary.
The optional Linear presentation branch encodes final pixels to sRGB outside the
original program body. Original player color-space configuration is unresolved.
