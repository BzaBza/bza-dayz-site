/* Draws the five stencil patterns exactly as the mod generates them.
 *
 * Why redraw them here instead of shipping PNGs: a stencil is a pair pattern,
 * so a picture of one is a picture of ONE of the 47 x 46 colour combinations.
 * Shipping them all is 10810 files and ~190 MB. The geometry, on the other
 * hand, is a few dozen lines - so the page carries the geometry and paints it
 * with whatever two colours the visitor picked.
 *
 * This is a line-for-line port of tools/texgen/generate.js (patternTileSvg and
 * the organic overlays, density level s0), down to the seeds. Same PRNG, same
 * call order, same rounding => the spots and leaves here are the same spots and
 * leaves that end up on the player's jacket. If the generator changes, this
 * file has to change with it.
 */
(function () {
  'use strict';

  var TILE = 256;
  // DENSITY_LEVELS[0] in the generator. s1/s2 exist in the code but have not
  // been reachable since 2026-07-26 - the tile density is picked from the item.
  var D = { stripes: 16, checker: 22 };

  // Deterministic PRNG - identical spot/leaf shapes on every generation.
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Seamlessness: every organic shape is drawn nine times, offset by one tile
  // in each direction, so whatever leaves the tile re-enters on the far side.
  function wrapped(cb) {
    var out = '';
    for (var dx = -1; dx <= 1; dx++)
      for (var dy = -1; dy <= 1; dy++)
        out += cb(dx * TILE, dy * TILE);
    return out;
  }

  function stripesV() {
    var step = TILE / D.stripes, out = '';
    for (var x = 0; x < TILE; x += step)
      out += '<rect x="' + x + '" y="0" width="' + step / 2 + '" height="' + TILE + '"/>';
    return out;
  }

  function stripesH() {
    var step = TILE / D.stripes, out = '';
    for (var y = 0; y < TILE; y += step)
      out += '<rect x="0" y="' + y + '" width="' + TILE + '" height="' + step / 2 + '"/>';
    return out;
  }

  function checker() {
    var c = TILE / D.checker, out = '';
    for (var y = 0; y < D.checker; y++)
      for (var x = 0; x < D.checker; x++)
        if ((x + y) % 2 === 0)
          out += '<rect x="' + x * c + '" y="' + y * c + '" width="' + c + '" height="' + c + '"/>';
    return out;
  }

  function spots() {
    var n = 100, rMin = 3, rMax = 6;
    var rnd = mulberry32(1000);
    var out = '';
    for (var i = 0; i < n; i++) {
      var x = rnd() * TILE, y = rnd() * TILE;
      var rx = rMin + rnd() * (rMax - rMin);
      var ry = rMin + rnd() * (rMax - rMin);
      var rot = rnd() * 180;
      out += wrapped(function (ox, oy) {
        var cx = (x + ox).toFixed(1), cy = (y + oy).toFixed(1);
        return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx.toFixed(1) +
               '" ry="' + ry.toFixed(1) + '" transform="rotate(' + rot.toFixed(0) +
               ' ' + cx + ' ' + cy + ')"/>';
      });
    }
    return out;
  }

  function leaves() {
    var n = 60, lMin = 12, lMax = 18;
    var rnd = mulberry32(2000);
    var out = '';
    for (var i = 0; i < n; i++) {
      var x = rnd() * TILE, y = rnd() * TILE;
      var len = lMin + rnd() * (lMax - lMin);
      var w = len * (0.38 + rnd() * 0.14);
      var rot = rnd() * 360;
      var half = len / 2;
      out += wrapped(function (ox, oy) {
        // a lens with pointed tips: two quadratic arcs meeting at the ends
        var cx = (x + ox).toFixed(1), cy = (y + oy).toFixed(1);
        var top = (y + oy - half).toFixed(1), bot = (y + oy + half).toFixed(1);
        return '<path d="M ' + cx + ' ' + top +
               ' Q ' + (x + ox + w / 2).toFixed(1) + ' ' + cy + ' ' + cx + ' ' + bot +
               ' Q ' + (x + ox - w / 2).toFixed(1) + ' ' + cy + ' ' + cx + ' ' + top +
               ' Z" transform="rotate(' + rot.toFixed(0) + ' ' + cx + ' ' + cy + ')"/>';
      });
    }
    return out;
  }

  var SHAPES = [stripesV, stripesH, checker, spots, leaves];

  window.STENCILS = {
    // Index and name must match PaintMod_Unlocks.PatternName(0..4).
    names: ['Stripes |', 'Stripes —', 'Checker', 'Spots', 'Leaves'],
    tile: TILE,

    /* One tile, as an <svg> string. Colours come from the CSS custom properties
       --sb (base) and --sa (accent) on any ancestor, so recolouring the whole
       page is one style write rather than a redraw. */
    svg: function (idx, opts) {
      opts = opts || {};
      var repeat = Math.max(1, opts.repeat || 1);
      var side = TILE * repeat;
      var body = '<rect class="bg" width="' + TILE + '" height="' + TILE + '"/>' +
                 '<g class="ac">' + SHAPES[idx]() + '</g>';
      if (repeat === 1) {
        return '<svg class="stencil" viewBox="0 0 ' + TILE + ' ' + TILE + '" ' +
               'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
               this.names[idx] + ' pattern">' + body + '</svg>';
      }
      // Repeated view: the same tile through an SVG <pattern>, which also
      // proves the tile is seamless - any gap would show as a grid line.
      var id = 'stn' + idx + 'x' + repeat;
      return '<svg class="stencil" viewBox="0 0 ' + side + ' ' + side + '" ' +
             'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
             this.names[idx] + ' pattern, tiled">' +
             '<defs><pattern id="' + id + '" width="' + TILE + '" height="' + TILE +
             '" patternUnits="userSpaceOnUse">' + body + '</pattern></defs>' +
             '<rect width="' + side + '" height="' + side + '" fill="url(#' + id + ')"/>' +
             '</svg>';
    },
  };
})();
