# ElantraBallLRC reconstruction

This scene uses the supplied JMGO bundle's `ball_20` mesh (600 vertices / 600
indices, faceted normals and both UV channels), not a generated sphere.
The Forward-pass `DynamicGeometry` vertex and fragment calculations are retained.
Unity UBO and sampler-location macros are disabled so WebGL2 receives ordinary
uniforms; shader body hashes in `provenance.json` exclude trailing newlines.

The material's original low / middle / high noise thresholds and intensities are
used unchanged. Eight host audio bands feed `AudioStrength0` through
`AudioStrength7`. This host mapping is not the recovered native audio algorithm.
The source MatCap, ramp, outline and vertex-noise textures drive the actual original
shader, including its time-driven hue changes and blink strip.

The original saved camera is at `(0,1,-9.5)`, FOV 60; the ball is at
`(0,1.07,-1.45)` with scale 2.3 and the saved quaternion rotation. No invented
rotation or bloom is added. Camera postprocessing is off in the source.

The `Circle` particle configuration specifies a burst of 120, radius 2.2, speed
1.5, lifetime 10, size 0.1, shrinking size, and alpha reaching zero at 40% of life.
The demo billboards use that configuration and the original circle texture.
Native `CircleEffect` retrigger timing is unresolved: a low-band rising-edge
trigger with a 0.5-second minimum interval is an explicit preview approximation.
Random seed/particle placement are deterministic approximations.

Lyrics use OPPOSans Regular, serialized font size 36 with auto-size bounds 5–60,
a 1920×100 text area centered at Y=0, and a shadow offset at Y=-10. There is no
serialized TextAnimator for this scene. Runtime max-character and layout overrides
still require native-method or original-device evidence.

The text component enables auto-sizing; its RectTransform vertical anchors are
both 0.5. These are exported as `lyrics.autoSize` and `lyrics.anchorY`. The original
Forward render state is retained in `scene.forwardState`; its Cull Back state
uses clockwise front faces with this wrapper's unreflected Unity coordinates.
`createElantraRenderer` accepts an optional `assetBase` URL for embedding elsewhere.

Re-export from the repository root with UnityPy:

```sh
python3 scripts/export-jmgo-elantra.py /tmp/jmgo-apks/Arwen.apk
```

`original.shader.txt`, `scene.json` and `provenance.json` retain the source evidence.
The optional linear presentation mode performs a final sRGB conversion outside
the original fragment body. The original player color-space setting remains unknown.
