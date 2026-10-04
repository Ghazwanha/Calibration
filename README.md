# Ghazwan Reference Calibration

Private electrical reference workspace for Fluke 5522A and 8508A. Four original PDF certificates and 1,200 extracted main-function records are included.

## Calculation rules
- Error = measured UUC − reference, in common SI units internally.
- Match instrument, function, range, condition, frequency and nominal amplitude.
- Interpolate errors only between amplitude brackets in the same series. No extrapolation, frequency interpolation or crossing zero without a zero point.
- At an interpolated amplitude select the larger absolute expanded uncertainty of the two brackets, with matching coverage factors.
- 8508A certificate relative ppm uncertainties are converted using the absolute reference value. Certificate U is one contribution, not a full uncertainty budget.
- Missing source results remain unavailable. Two records have explicit source-review blocks due to a nominal-sign inconsistency and an obscured reference value.

Main voltage/current/resistance/capacitance/frequency, waveform and harmonic records are imported. Thermal, phase, power, AC with DC offset and SC600 option tables remain in the original PDFs but are not imported. Source ranges are preserved; different old/new range labels are not silently substituted. Old capacitance entries without a reported frequency are kept as unspecified.

## Persistence
D1 stores the shared owner-private workspace, source overrides and edit archive. POST uses an optimistic version check. Local storage contains only decimal-place preference. JSON backup import/export provides a manual backup.

## Checks
`node --experimental-strip-types tests/calibration.mjs`
`node node_modules/typescript/bin/tsc --noEmit`

Use Sites bundled build and hosting workflow. Production applies the schema migration before uploading the Worker. For local preview apply the migration once using the generated Wrangler configuration and `.wrangler/state`.
