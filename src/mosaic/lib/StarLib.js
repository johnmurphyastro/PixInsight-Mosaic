/* global ImageWindow, ChannelExtraction, UndoFlag_NoSwapFile, MultiscaleLinearTransform, StdButton_Yes, GraphDialog */

// Version 1.0 (c) John Murphy 20th-Oct-2019
//
// ======== #license ===============================================================
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the
// Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along with
// this program.  If not, see <http://www.gnu.org/licenses/>.
// =================================================================================
//"use strict";
#define __PJSR_NO_STAR_DETECTOR_TEST_ROUTINES 1
#include "StarDetector.jsh"

/**
 * @param {Star} refStar
 * @param {Star} tgtStar
 * @returns {StarPair}
 */
function StarPair(refStar, tgtStar){
    this.tgtStar = tgtStar;
    this.refStar = refStar;
}

/**
 * Stores the array of StarPair and the LinearFitData that was calculated from them
 * @param {StarPair[]} starPairArray
 * @returns {StarPairs}
 */
function StarPairs(starPairArray){
    this.starPairArray = starPairArray;
    this.linearFitData = null;
}

/**
 * 
 * @returns {StarsDetected}
 */
function StarsDetected(){
    this.nChannels = 1;
    
    /** {star[][]} color array of reference stars */
    this.refColorStars = null;
    /** {star[][]} color array of target stars */
    this.tgtColorStars = null;
    /** {Star[]} refColorStars and tgtColorStars, sorted by star flux */
    this.allStars = null;
    /** Gets set to background rectangle inflation around star */
    this.bkgDelta = 3;
    
    const self = this;
    
    /**
     * @param {View} refView
     * @param {View} tgtView
     * @param {Number} logSensitivity
     * @param {MosaicCache} cache
     */
    this.detectStars = function (refView, tgtView, logSensitivity, cache) {
        this.nChannels = refView.image.isColor ? 3 : 1;
        console.writeln("<b><u>Detecting stars</u></b>");
        processEvents();
        const overlapBox = cache.overlap.overlapBox;
        let detectStarTime = new Date().getTime();
        // Reference and target image stars
        if (cache.refColorStars === null || cache.tgtColorStars === null){
            cache.allStars = null;
            cache.refColorStars = [];
            cache.tgtColorStars = [];
            let overlapMask = cache.overlap.getOverlapMask();
            for (let c = 0; c < this.nChannels; c++) {
                let refStars = findStars(refView, overlapMask, overlapBox, logSensitivity, c);
                cache.refColorStars.push(refStars);
                console.writeln("Reference[", c, "] detected ", refStars.length, " stars");
                processEvents();
                
                let tgtStars = findStars(tgtView, overlapMask, overlapBox, logSensitivity, c);
                cache.tgtColorStars.push(tgtStars);
                console.writeln("Target   [", c, "] detected ", tgtStars.length, " stars");
                processEvents();
            }
            overlapMask.free();
        }
        this.refColorStars = cache.refColorStars;
        this.tgtColorStars = cache.tgtColorStars;
        
        // Reference and target stars, sorted by star flux
        if (cache.allStars === null){
            cache.allStars = combienStarArrays(cache.refColorStars, cache.tgtColorStars);
        }
        this.allStars = cache.allStars;

        console.writeln("\n<b>Star cache:</b>\n" + cache.getStatus() + 
                "\n    (" + getElapsedTime(detectStarTime) + ")\n");
        processEvents();
    };
    
    /**
     * 
     * @param {View} refView
     * @param {PhotometricMosaicData} data Values from user interface
     * @returns {StarPairs[]} Array of StarPairs for all color channels
     */
    this.getColorStarPairs = function(refView, data){
        let colorStarPairs = [];
        let nChannels = refView.image.isColor ? 3 : 1;
        for (let channel=0; channel < nChannels; channel++){
            let starPairs = findMatchingStars(channel, data);
            colorStarPairs.push(starPairs);
        }
        return colorStarPairs;
    };  
    
    /**
     * Private
     * @param {View} view
     * @param {Image} mask Bitmap represents overlapping region
     * @param {Rect} overlapBox Bounding box of the overlap area
     * @param {Number} logSensitivity
     * @param {Number} channel
     * @returns {Star[]}
     */
    function findStars(view, mask, overlapBox, logSensitivity, channel){
        let lastProgressPc = 0;
        function progressCallback(count, total){
            if (count === 0){
                console.write("<end><cbr>Detecting stars:   0%");
                lastProgressPc = 0;
                processEvents();
            } else{
                let pc = Math.round(100 * count / total);
                if (pc > lastProgressPc && (pc > lastProgressPc + 5 || pc === 100)){
                    if (pc < 100){
                        console.write(format("\b\b\b\b%3d%%", pc));
                    } else {
                        console.write(format("\b\b\b\b"));
                    }
                    lastProgressPc = pc;
                    processEvents();
                }
            }
            return true;
        }

        let starImage;
        // Create grey scale 32bit floating point images
        let width = overlapBox.width;
        let height = overlapBox.height;
        starImage = new Image(width, height, 1);
        let samples = new Float32Array(overlapBox.area);
        view.image.getSamples(samples, overlapBox, channel);
        starImage.setSamples(samples);
        
        // In tests this was 8% slower, probably because we had to assign the whole area
//        starImage.assign(view.image, new Rect(width, height), channel, channel); // 8% slower
        // Detect stars in target and reference images
        let starDetector = new StarDetector();
        starDetector.progressCallback = progressCallback;
        starDetector.mask = mask;
        starDetector.sensitivity = Math.pow(10.0, logSensitivity);
        starDetector.upperLimit = 1;
        // Noise reduction affects the accuracy of the photometry
        starDetector.applyHotPixelFilterToDetectionImage = false;
        self.bkgDelta = starDetector.bkgDelta;
        
        const x0 = overlapBox.x0;
        const y0 = overlapBox.y0;
        let stars = starDetector.stars(starImage);
        starImage.free();
        for (let star of stars){
            star.pos.x += x0;
            star.pos.y += y0;
        }
        return stars;
    };
    
    /**
     * Finds the stars that exist in both images that have no pixel above upperLimit.
     * @param {Number} channel
     * @param {PhotometricMosaicData} data Values from user interface
     * @returns {StarPairs} Matching star pairs. All star pixels are below the upperLimit.
     */
    function findMatchingStars(channel, data) {
        let searchRadius = data.starSearchRadius;
        let rSqr = searchRadius * searchRadius;

        /**
         * Sort on flux, brightest stars at the end of the array
         * @param {Star} a
         * @param {Star} b
         * @returns {Number}
         */
        function sortOnFlux(a, b) {
            return a.flux - b.flux;
        };

        /**
         * Filter out stars with a peak pixel value greater than peakUpperLimit,
         * sort the stars on flux (brightest star at end of array).
         * Limit the total number of stars to a percentage of the input stars,
         * or a percentage of 1000 if there are more than 1000 stars in the input
         * array. The dimmest stars are filtered out.
         * @param {Star[]} stars Stars to be filered. This array is not modified.
         * @param {PhotometricMosaicData} data Values from user interface
         * @returns {Star[]} The filtered stars
         */
        function filterStars(stars, data){
            let peakUpperLimit = data.linearRange;
            let limitStarsPercent = data.limitPhotoStarsPercent;
            let filteredStars = [];
            for (let star of stars) {
                if (star.peak < peakUpperLimit) {
                    filteredStars.push(star);
                }
            }
            filteredStars.sort(sortOnFlux);
            let maxStars = Math.min(filteredStars.length, 1000) * limitStarsPercent / 100;
            if (filteredStars.length > maxStars) {
                filteredStars = filteredStars.slice(filteredStars.length - maxStars);
            }
            return filteredStars;
        };
        
        /**
         * Use flux and search radius to match stars.
         * Start with the brightest ref star and look for the brightest tgt star
         * within the searchRadius. If a tgt star is found it is removed from tgtStar array.
         * @param {Star[]} tgtStars Modified (entries are removed)
         * @param {Star[]} refStars
         * @param {Number} searchRadius
         * @param {Boolean} useRange If true, reject pairs if the flux difference is too great
         * @param {Number} minGradient Minimum allowed (ref flux / target flux) 
         * @param {Number} maxGradient Maximum allowed (ref flux / target flux) 
         * @returns {StarPair[]} Array of matched stars
         */
        function matchStars(tgtStars, refStars, searchRadius, useRange, minGradient, maxGradient){
            let starPairArray = [];
            let r = refStars.length;
            while (r--) {
                let rStar = refStars[r];
                let t = tgtStars.length;
                while (t--) {
                    let tStar = tgtStars[t];
                    if (useRange){
                        let gradient = rStar.flux / tStar.flux;
                        if (gradient < minGradient || gradient > maxGradient){
                            continue;
                        }
                    }
                    let deltaX = Math.abs(tStar.pos.x - rStar.pos.x);
                    if (deltaX < searchRadius){
                        let deltaY = Math.abs(tStar.pos.y - rStar.pos.y);
                        if (deltaY < searchRadius && rSqr > deltaX * deltaX + deltaY * deltaY) {
                            starPairArray.push(new StarPair(rStar, tStar));
                            // Remove star so it is not matched multiple times
                            // This should be efficient because the brightest stars are at the end of the array
                            tgtStars.splice(t, 1);
                            break;
                        }
                    }
                }
            }
            return starPairArray;
        };
        
        let refStars = filterStars(self.refColorStars[channel], data);
        let tgtStars = filterStars(self.tgtColorStars[channel], data);
        
        // Use our first pass to calculate the approximate gradient. This pass might contain
        // stars that matched with noise or very faint stars
        let tgtStarsClone = tgtStars.slice();
        let starPairArray = matchStars(tgtStarsClone, refStars, searchRadius, false, 0, 0);
        if (starPairArray.length > 10) {
            // Second pass rejects stars if (refFlux / tgtFlux) is higher or lower than expected
            let linearFit = calculateScale(new StarPairs(starPairArray));
            const gradient = linearFit.m;
            const tolerance = data.starFluxTolerance;
            let starPairArray2 = matchStars(tgtStars, refStars, searchRadius,
                    true, gradient / tolerance, gradient * tolerance);
            if (starPairArray2.length > 5){
                let nRemoved = starPairArray.length - starPairArray2.length;
                if (nRemoved){
                    console.writeln("Channel[" + channel + "] Removed " + nRemoved +
                            " photometry stars with large flux differences");
                }
                return new StarPairs(starPairArray2);
            }
        }
        return new StarPairs(starPairArray);
    };

    /**
     * Combien star arrays removing duplicate stars (keep star with maximum flux)
     * @param {star[][]} refColorStars color array of reference stars
     * @param {star[][]} tgtColorStars color array of target stars
     * @returns {Star[]} All stars, sorted by brightness (brightest first)
     */
    function combienStarArrays(refColorStars, tgtColorStars){
        /**
         * @param {Star} star
         * @returns {String}
         */
        function starToKey(star){
            return "" + star.pos.x + "," + star.pos.y;
        };
        /**
         * @param {Map} starMap
         * @param {Star[]} stars
         */
        function addFirstArray(starMap, stars) {
            for (let star of stars) {
                starMap.set(starToKey(star), star);
            }
        };
        /**
         * @param {Map} starMap
         * @param {Star[]} stars
         */
        function addStars(starMap, stars){
            for (let star of stars){
                // keep star with maximum flux
                let key = starToKey(star);
                let mapStar = starMap.get(key);
                if (mapStar === undefined || mapStar.flux < star.flux){
                    starMap.set(key, star);
                }
            }
        };
        /**
         * @param {Map} starMap
         * @returns {Star[]} All stars, sorted by brightness (brightest first)
         */
        function getSortedStars(starMap){
            let stars = [];
            for (let star of starMap.values()){
                stars.push(star);
            }
            return stars.sort((a, b) => b.flux - a.flux);
        };

        // Add all the stars to a map to reject duplicates at the same coordinates
        let starMap = new Map();
        addFirstArray(starMap, refColorStars[0]);
        for (let c = 1; c < refColorStars.length; c++) {
            addStars(starMap, refColorStars[c]);
        }
        for (let c = 0; c < tgtColorStars.length; c++) {
            addStars(starMap, tgtColorStars[c]);
        }
        return getSortedStars(starMap);
    };
}

/**
 * Removes the worst outlier from the photometry least squares fit line
 * @param {StarPairs} starPairs A star pair will be removed
 * @param {LinearFitData} linearFit
 * @returns {StarPairs}
 */
function removeStarPairOutlier(starPairs, linearFit){
    let maxErr = Number.NEGATIVE_INFINITY;
    let removeStarPairIdx = -1;
    for (let i=0; i<starPairs.starPairArray.length; i++){
        let starPair = starPairs.starPairArray[i];
        // y = ref; x = tgt
        let y = eqnOfLineCalcY(starPair.tgtStar.flux, linearFit.m, linearFit.b);
        let dif = Math.abs(y - starPair.refStar.flux);
        if (dif > maxErr){
            maxErr = dif;
            removeStarPairIdx = i;
        }
    }
    if (removeStarPairIdx !== -1){
        starPairs.starPairArray.splice(removeStarPairIdx, 1);
    }
    return starPairs;
}

/**
 * Calculates the max and min star flux
 * @returns {StarMinMax}
 */
function StarMinMax() {
    this.maxRefFlux = Number.NEGATIVE_INFINITY;
    this.maxTgtFlux = Number.NEGATIVE_INFINITY;
    this.minRefFlux = Number.POSITIVE_INFINITY; 
    this.minTgtFlux = Number.POSITIVE_INFINITY;

    /**
     * Find max and min for the (corrected) star flux 
     * @param {StarPair[]} starPairArray
     * @returns {undefined}
     */
    this.calculateMinMax = function(starPairArray){
        for (let starPair of starPairArray) {
            this.maxRefFlux = Math.max(this.maxRefFlux, starPair.refStar.flux);
            this.maxTgtFlux = Math.max(this.maxTgtFlux, starPair.tgtStar.flux);
            this.minRefFlux = Math.min(this.minRefFlux, starPair.refStar.flux);
            this.minTgtFlux = Math.min(this.minTgtFlux, starPair.tgtStar.flux);
        }
    };
}

/**
 * 
 * @param {FITSKeyword} keywords
 * @param {StarPairs[]} colorStarPairs StarPairs for L or R,G,B
 * @param {type} nColors
 * @param {type} rect OverlapBox for photometricStar image, null for photometric graph
 */
function addScaleToFitsHeader(keywords, colorStarPairs, nColors, rect){
    let maxErr = Number.NEGATIVE_INFINITY;
    let errStar = null;
    for (let c = 0; c < nColors; c++) {
        let starPairs = colorStarPairs[c];
        let linearFit = starPairs.linearFitData;
        let comment = "scale[" + c + "]: " + linearFit.m.toPrecision(5) +
                " (" + starPairs.starPairArray.length + " stars)";
        keywords.push(new FITSKeyword("COMMENT", "", comment));

        for (let starPair of starPairs.starPairArray) {
            // y = ref; x = tgt
            let y = eqnOfLineCalcY(starPair.tgtStar.flux, linearFit.m, linearFit.b);
            let dif = Math.abs(y - starPair.refStar.flux);
            if (dif > maxErr) {
                maxErr = dif;
                errStar = starPair.tgtStar;
            }
        }
    }
    if (maxErr > Number.NEGATIVE_INFINITY) {
        let x = Math.round(errStar.pos.x);
        let y = Math.round(errStar.pos.y);
        if (rect){
            x -= rect.x0;
            y -= rect.y0;
        }
        let text = "Max error: " + maxErr.toPrecision(5) + " at (" + x + ", " + y + ")";
        keywords.push(new FITSKeyword("COMMENT", "", text));
    }
}

/**
 * @param {String} refView
 * @param {String} tgtView
 * @param {Number} height
 * @param {StarPairs[]} colorStarPairs StarPairs for L or R,G,B
 * @param {PhotometricMosaicData} data User settings used to create FITS header
 * @returns {Boolean} True if graph was displayed
 */
function displayStarGraph(refView, tgtView, height, colorStarPairs, data){
    /**
     * @param {ImageWindow} graphWindow Graph window
     * @param {StarPairs[]} colorStarPairs StarPairs for each color channel
     * @param {PhotometricMosaicData} data User settings used to create FITS header
     * @return {undefined}
     */
    function starGraphFitsHeader(graphWindow, colorStarPairs, data){
        let view = graphWindow.mainView;
        let nColors = colorStarPairs.length;
        view.beginProcess(UndoFlag_NoSwapFile); // don't add to undo list
        let keywords = graphWindow.keywords;
        fitsHeaderImages(keywords, data);
        fitsHeaderStarDetection(keywords, data);
        fitsHeaderPhotometry(keywords, data);
        addScaleToFitsHeader(keywords, colorStarPairs, nColors, null);
        graphWindow.keywords = keywords;
        view.endProcess();
    };
    /**
     * Draw graph lines and points for a single color
     * @param {Graph} graph
     * @param {Number} lineColor e.g. 0xAARRGGBB
     * @param {StarPairs} starPairs Contains the array of SamplePair
     * @param {Number} pointColor e.g. 0xAARRGGBB
     * @returns {undefined}
     */
    function drawStarLineAndPoints(graph, lineColor, starPairs, pointColor){
        let linearFit = starPairs.linearFitData;
        graph.drawLine(linearFit.m, linearFit.b, lineColor);
        for (let starPair of starPairs.starPairArray){
            graph.drawPoint(starPair.tgtStar.flux, starPair.refStar.flux, pointColor);
        }
    };
    
    let targetName = tgtView.fullId;
    let referenceName = refView.fullId;
    let targetLabel = "Target (" + targetName + ")";
    let referenceLabel = "Reference (" + referenceName + ")";
    
    // Create the graph axis and annotation.
    let minMax = new StarMinMax();
    colorStarPairs.forEach(function (starPairs) {
        minMax.calculateMinMax(starPairs.starPairArray);
    });
    if (minMax.minRefFlux === Number.POSITIVE_INFINITY || minMax.minTgtFlux === Number.NEGATIVE_INFINITY){
        // Unable to display graph. No points to display so graph axis min/max range cannot be calculated.
        return false;
    }
    let startOffsetX = (minMax.maxTgtFlux - minMax.minTgtFlux) / 100;
    let startOffsetY = (minMax.maxRefFlux - minMax.minRefFlux) / 100;
    // If there is only one point, min & max will be equal. Prevent zero length axis.
    if (startOffsetX === 0){
        startOffsetX = minMax.minTgtFlux !== 0 ? minMax.minTgtFlux : 0.0001;
    }
    if (startOffsetY === 0){
        startOffsetY = minMax.minRefFlux !== 0 ? minMax.minRefFlux : 0.0001;
    }
    let graphWithAxis = new Graph(minMax.minTgtFlux - startOffsetX, minMax.minRefFlux - startOffsetY,
                                  minMax.maxTgtFlux, minMax.maxRefFlux);
    graphWithAxis.setYAxisLength(height);
    graphWithAxis.createGraph(targetLabel, referenceLabel);

    // Now add the data to the graph...
    if (colorStarPairs.length === 1){ // B&W
        drawStarLineAndPoints(graphWithAxis, 0xFF777777, colorStarPairs[0], 0xFFFFFFFF);
    } else {
        // Color. Need to create 3 graphs for r, g, b and then merge them (binary OR) so that
        // if three samples are on the same pixel we get white and not the last color drawn
        let lineColors = [0xFF770000, 0xFF007700, 0xFF000077]; // r, g, b
        let pointColors = [0xFFFF0000, 0xFF00FF00, 0xFF0000FF]; // r, g, b
        for (let c = 0; c < colorStarPairs.length; c++){
            let graphAreaOnly = graphWithAxis.createGraphAreaOnly();
            drawStarLineAndPoints(graphAreaOnly, lineColors[c], colorStarPairs[c], pointColors[c]);
            graphWithAxis.mergeWithGraphAreaOnly(graphAreaOnly);
        }
    }
    // Display graph in script dialog
    GraphDialog.prototype = new Dialog;
    let graph = new GraphDialog(graphWithAxis.bitmap, "Photometry Graph", graphWithAxis.screenToWorld);
    if (graph.execute() === StdButton_Yes){
        // User requested graph saved to PixInsight View
        let isColor = refView.image.isColor;
        let windowTitle = WINDOW_ID_PREFIX() + targetName + "__Photometry";
        let imageWindow = graphWithAxis.createWindow(windowTitle, isColor);
        starGraphFitsHeader(imageWindow, colorStarPairs, data);
        imageWindow.show();
        imageWindow.zoomToFit();
    }
    return true;
}

/**
 * Display the star and background square for each photometric star.
 * The new image is limited to the overlap area.
 * @param {View} refView Used to create background image
 * @param {StarsDetected} detectedStars
 * @param {StarPairs[]} colorStarPairs Detected star pairs for each color
 * @param {String} targetId Used to create ImageWindow title
 * @param {PhotometricMosaicData} data User settings used to create FITS header
 */
function displayPhotometryStars(refView, detectedStars, colorStarPairs, targetId, data) {
    
    /** Creates a bitmap
     * @param {Rect} overlapBox Bitmap area
     * @returns {Bitmap}
     */
    function createBitmap(overlapBox){
        let bmp = new Bitmap(overlapBox.width, overlapBox.height);
        bmp.fill(0x00000000);
        return bmp;
    };
    
    /** Create vector graphics context for the specified bitmap. 
     * Pen is set to color. Anitaliasing is off.
     * @param {Bitmap} bitmap
     * @param {Number} color
     * @returns {VectorGraphics}
     */
    function createGraphics(bitmap, color){
        let g = new VectorGraphics(bitmap);
        g.antialiasing = false;
        g.pen = new Pen(color);
        return g;
    };
    
    const overlapBox = data.cache.overlap.overlapBox;
    let offsetX = -overlapBox.x0;
    let offsetY = -overlapBox.y0;
    let color = [0xFFFF0000, 0xFF00FF00, 0xFF0000FF]; // red, green, blue
    let bmp = createBitmap(overlapBox);
    let bmpG = createGraphics(bmp, 0xFF000000); // Used to make non transparent pixels
    let bitmaps = []; // bitmap for each color
    for (let c = 0; c < colorStarPairs.length; c++) {
        let starPairs = colorStarPairs[c].starPairArray;
        bitmaps[c] = createBitmap(overlapBox);
        let G = createGraphics(bitmaps[c], color[c]); // Used to draw color squares
        for (let i = 0; i < starPairs.length; ++i){
            let starPair = starPairs[i];
            let tgtStar = starPair.tgtStar;
            let refStar = starPair.refStar;
            let maxSize = Math.max(tgtStar.size,refStar.size);
            let s = Math.sqrt(maxSize); // size is area of the square. s is length of side.
            let rect = new Rect(s, s);
            rect.center = new Point(refStar.pos.x + offsetX, refStar.pos.y + offsetY);
            G.strokeRect(rect);
            bmpG.strokeRect(rect);
            let bg = rect.inflatedBy( detectedStars.bkgDelta );
            G.strokeRect(bg);
            bmpG.strokeRect(bg);
        }
        G.end();
    }
    bmpG.end();
    // Combien the 3 bitmaps to create color squares.
    for (let c = 0; c < colorStarPairs.length; c++) {
        bmp.or(bitmaps[c]);
    }

    let keywords = [];
    fitsHeaderImages(keywords, data);
    fitsHeaderStarDetection(keywords, data);
    fitsHeaderPhotometry(keywords, data);
    addScaleToFitsHeader(keywords, colorStarPairs, colorStarPairs.length, overlapBox);

    let title = WINDOW_ID_PREFIX() + targetId + "__PhotometryStars";
    createOverlapImage(refView, data.cache.overlap, bmp, title, keywords, 1);
}

/**
 * Display the detected stars as squares.
 * Each square is the star's photometry background bounding box.
 * The new image is limited to the overlap area.
 * @param {View} view Used to create background image
 * @param {Star[][]} colorStars Color array of star arrays
 * @param {String} postfix Used to create ImageWindow title
 * @param {PhotometricMosaicData} data User settings used to create FITS header
 */
function displayDetectedStars(view, colorStars, postfix, data) {
    /** Creates a bitmap
     * @param {Rect} overlapBox Bitmap area
     * @returns {Bitmap}
     */
    function createBitmap(overlapBox){
        let bmp = new Bitmap(overlapBox.width, overlapBox.height);
        bmp.fill(0x00000000);
        return bmp;
    };
    
    /** Create vector graphics context for the specified bitmap. 
     * Pen is set to color. Anitaliasing is off.
     * @param {Bitmap} bitmap
     * @param {Number} color
     * @returns {VectorGraphics}
     */
    function createGraphics(bitmap, color){
        let g = new VectorGraphics(bitmap);
        g.antialiasing = false;
        g.pen = new Pen(color);
        return g;
    };
    
    const overlapBox = data.cache.overlap.overlapBox;
    let offsetX = -overlapBox.x0;
    let offsetY = -overlapBox.y0;
    let color = [0xFFFF0000, 0xFF00FF00, 0xFF0000FF]; // red, green, blue
    let bmp = createBitmap(overlapBox);
    let bmpG = createGraphics(bmp, 0xFF000000); // Used to make non transparent pixels
    let bitmaps = []; // bitmap for each color
    for (let c = 0; c < colorStars.length; c++) {
        let stars = colorStars[c];
        bitmaps[c] = createBitmap(overlapBox);
        let G = createGraphics(bitmaps[c], color[c]); // Used to draw color squares
        for (let i = 0; i < stars.length; ++i){
            let star = stars[i];
            let s = Math.sqrt(star.size) + 5; // size is area of the square. s is length of side.
            let rect = new Rect(s, s);
            rect.center = new Point(star.pos.x + offsetX, star.pos.y + offsetY);
            G.strokeRect(rect);
            bmpG.strokeRect(rect);
        }
        G.end();
    }
    bmpG.end();
    // Combien the 3 bitmaps to create color squares.
    for (let c = 0; c < colorStars.length; c++) {
        bmp.or(bitmaps[c]);
    }

    let keywords = [];
    keywords.push(new FITSKeyword("HISTORY", "", view.fullId));
    fitsHeaderStarDetection(keywords, data);

    let title = WINDOW_ID_PREFIX() + view.fullId + "__DetectedStars" + postfix;
    createOverlapImage(view, data.cache.overlap, bmp, title, keywords, 1);
}

/**
 * Display the masked stars as circles
 * The new image is limited to the overlap area.
 * @param {View} refView Used to create background image
 * @param {Rect} joinArea 
 * @param {StarsDetected} detectedStars
 * @param {String} targetId Used to create ImageWindow title
 * @param {Boolean} antialias
 * @param {String} postfix Used to create ImageWindow title
 * @param {PhotometricMosaicData} data User settings used to create FITS header
 */
function displayMaskStars(refView, joinArea, detectedStars, targetId, antialias, postfix, data) {
    let offsetX = -joinArea.x0;
    let offsetY = -joinArea.y0;
    let bmp = new Bitmap(joinArea.width, joinArea.height);
    bmp.fill(0x00000000);
    let G = new VectorGraphics(bmp);
    G.pen = new Pen(0xffff0000);
    G.antialiasing = antialias;
    
    let allStars = detectedStars.allStars;
    let firstNstars;
    if (data.limitMaskStarsPercent < 100){
        firstNstars = Math.floor(allStars.length * data.limitMaskStarsPercent / 100);
    } else {
        firstNstars = allStars.length;
    }
    
    for (let i = 0; i < firstNstars; ++i){
        let star = allStars[i];
        // size is the area. sqrt gives box side length. Half gives circle radius
        let radius = Math.sqrt(star.size)/2;
        let x = star.pos.x + offsetX;
        let y = star.pos.y + offsetY;
        G.strokeCircle(x, y, radius * data.radiusMult + data.radiusAdd);
    }
    G.end();

    let title = WINDOW_ID_PREFIX() + targetId + postfix;
    
    let keywords = [];
    fitsHeaderImages(keywords, data);
    fitsHeaderStarDetection(keywords, data);
    fitsHeaderMask(keywords, data);
    
    createJoinImage(refView, joinArea, data.cache.overlap, bmp, title, keywords, 1);
}

/**
 * @param {View} tgtView Used to access the target view fullId
 * @param {Overlap} overlap Specifies the overlapping pixels
 * @param {Rect} joinRect Restricts the mask to join instead of using all overlap pixels
 */
function createJoinMask(tgtView, overlap, joinRect){
    const overlapMask = overlap.getFullImageMask();
    const width = overlapMask.width;
    const height = overlapMask.height;
    const maskValue = 0.8;
    // Restrict the mask to the joinRect rather than using the whole overlap
    let maskSamples = new Float32Array(joinRect.area);
    overlapMask.getSamples(maskSamples, joinRect);
    overlapMask.free();
    for (let i = 0; i < maskSamples.length; i++){
        // When overlapMask is 1, mask will be transparent, which is what we want.
        if (maskSamples[i] === 0){
            // When overlapMask is 0, it will be solid red. We want some transparency.
            maskSamples[i] = maskValue;
        }
    }
    let title = WINDOW_ID_PREFIX() + tgtView.fullId + "__JoinMask";
    let w = new ImageWindow(width, height, 1, 8, false, false, title);
    let view = w.mainView;
    view.beginProcess(UndoFlag_NoSwapFile);
    view.image.fill(maskValue);
    view.image.setSamples(maskSamples, joinRect);
    view.endProcess();
    w.show();
}

/**
 * @param {View} tgtView
 * @param {Rect} joinArea 
 * @param {StarsDetected} detectedStars
 * @param {PhotometricMosaicData} data User settings used to create FITS header
 */
function displayMask(tgtView, joinArea, detectedStars, data){
    let postfix = "Mask";
    let title = WINDOW_ID_PREFIX() + tgtView.fullId + "__" + data.limitMaskStarsPercent + "_" + postfix;
    let bmp = new Bitmap(tgtView.image.width, tgtView.image.height);
    bmp.fill(0xffffffff);
    
    let firstNstars;
    if (data.limitMaskStarsPercent < 100){
        firstNstars = Math.floor(detectedStars.allStars.length * data.limitMaskStarsPercent / 100);
    } else {
        firstNstars = detectedStars.allStars.length;
    }
    
    let clipRect = new Rect(joinArea);
    clipRect.deflateBy(3); // to allow for the 3 pixel soft edge growth
    let G = new VectorGraphics(bmp);
    G.antialiasing = true;
    G.brush = new Brush();
    G.clipRect = clipRect;
    
    for (let i = 0; i < firstNstars; ++i){
        let star = detectedStars.allStars[i];
        // size is the area. sqrt gives box side length. Half gives circle radius
        let radius = (Math.sqrt(star.size)/2) * data.radiusMult + data.radiusAdd;
        G.fillCircle(star.pos, radius);
    }
    G.end();
    bmp.invert();

    // Create new window and copy bitmap to its image.
    // width, height, nChannels, bitsPerSample, floatSample, color, title
    let w = new ImageWindow(bmp.width, bmp.height, 1, 8, false, false, title);
    let view = w.mainView;
    view.beginProcess(UndoFlag_NoSwapFile);
    view.image.blend(bmp);

    // Make the star edges soft
    let P = new MultiscaleLinearTransform;
    P.layers = [// enabled, biasEnabled, bias, noiseReductionEnabled, noiseReductionThreshold, noiseReductionAmount, noiseReductionIterations
        [false, true, 0.000, false, 3.000, 1.00, 1],
        [false, true, 0.000, false, 3.000, 1.00, 1],
        [true, true, 0.000, false, 3.000, 1.00, 1]
    ];
    P.transform = MultiscaleLinearTransform.prototype.StarletTransform;
    P.executeOn(w.mainView, false);
    
    // Make sure the star mask circles do not include pixels beyond the overlap.
    let overlapMask = data.cache.overlap.getFullImageMask();
    let minX = Math.max(0, joinArea.x0 - 10);
    let minY = Math.max(0, joinArea.y0 - 10);
    let maxX = Math.min(bmp.width, joinArea.x1 + 10);
    let maxY = Math.min(bmp.height, joinArea.y1 + 10);
    for (let x = minX; x < maxX; x++){
        for (let y = minY; y < maxY; y++){
            if (overlapMask.sample(x, y) === 0 && view.image.sample(x, y) !== 0){
                view.image.setSample(0, x, y);
            }
        }
    }
    overlapMask.free();

    let keywords = [];
    fitsHeaderImages(keywords, data);
    fitsHeaderStarDetection(keywords, data);
    fitsHeaderMask(keywords, data);
    
    w.keywords = keywords;
    view.endProcess();
    w.show();
}

/**
 * Create an image from an area in the refView and the supplied bitmap.
 * The background is copied from refView, but pixels not included in the overlapMask are set
 * to black. The bitmap image is copied on top of the background. 
 * The bitmap image must have the same width and height as the specified area.
 * @param {View} refView Used to create background image
 * @param {Rect} imageRect The area to copy from refView 
 * @param {TypedArray} maskSamples
 * @param {Bitmap} bmp The bitmap image to lay on top of the background image
 * @param {String} title Window title
 * @param {FITSKeyword[]} fitsKeyWords
 * @param {Number} minZoom -2 is half size, 1 is 1:1
 */
function createImageFromRefAndBitmap(refView, imageRect, maskSamples, bmp, title, fitsKeyWords, minZoom){
    /**
     * Get all the samples from the image that are within the area rectangle.
     * @param {Float32Array} refSamples Overlap area from refView (modified)
     * @param {Float32Array} mask If mask is zero, set refSamples to zero
     */
    function applyMask(refSamples, mask) {
        for (let i = mask.length - 1; i > -1; i--) {
            if (mask[i] === 0) {
                refSamples[i] = 0;
            }
        }
    };
    
    if (bmp.width !== imageRect.width || bmp.height !== imageRect.height){
        console.criticalln("Error in createImageFromRefAndBitmap: bmp size does not match overlap");
        return;
    }
    let refSamples = new Float32Array(maskSamples.length);
    let rect = new Rect(bmp.width, bmp.height);
    
    // If read only, we can use the image directly.
    // If write access, we need to access it via the view.
    let refImage = refView.image;
    //  Width, height, n channels, bitsPerSample, float, color, title
    let w = new ImageWindow(bmp.width, bmp.height, 3, 16, false, true, title);
    let view = w.mainView;
    view.beginProcess(UndoFlag_NoSwapFile);
    if (refImage.isColor){
        for (let c = 0; c < 3; c++){
            refImage.getSamples(refSamples, imageRect, c);
            applyMask(refSamples, maskSamples);
            view.image.setSamples(refSamples, rect, c);
        }
    } else {
        refImage.getSamples(refSamples, imageRect, 0);
        applyMask(refSamples, maskSamples);
        view.image.setSamples(refSamples, rect, 0);
        view.image.setSamples(refSamples, rect, 1);
        view.image.setSamples(refSamples, rect, 2);
    }
    
    // Copy the bitmap image onto the top of the image
    view.image.blend(bmp);
    if (fitsKeyWords.length > 0){
        w.keywords = fitsKeyWords;
    }
    view.endProcess();

    // Ensure the user can see it!
    view.stf = refView.stf;
    w.zoomToFit();
    if (w.zoomFactor < minZoom){
        w.zoomFactor = minZoom;
        w.fitWindow();
    }
    w.show();
    
}

/**
 * Create an image from the overlapBox area of the refView and the supplied bitmap.
 * The background is copied from refView, but pixels not included in the overlapMask are set
 * to black. The bitmap image is copied on top of the background. 
 * The bitmap image must have the same width and height as the overlapBox.
 * @param {View} refView Used to create background image
 * @param {Overlap} overlap Overlapping pixels mask
 * @param {Bitmap} bmp The bitmap image to lay on top of the background image
 * @param {String} title Window title
 * @param {FITSKeyword[]} fitsKeyWords
 * @param {Number} minZoom -2 is half size, 1 is 1:1
 */
function createOverlapImage(refView, overlap, bmp, title, fitsKeyWords, minZoom) {
    // Create the new image and copy the samples from refView to it
    createImageFromRefAndBitmap(refView, overlap.overlapBox, overlap.overlapBuf,
            bmp, title, fitsKeyWords, minZoom);
}

/**
 * Create an image from an area in the refView and the supplied bitmap.
 * The background is copied from refView, but pixels not included in the overlapMask are set
 * to black. The bitmap image is copied on top of the background. 
 * The bitmap image must have the same width and height as the specified area.
 * @param {View} refView Used to create background image
 * @param {Rect} joinRect The area to copy from refView 
 * @param {Overlap} overlap
 * @param {Bitmap} bmp The bitmap image to lay on top of the background image
 * @param {String} title Window title
 * @param {FITSKeyword[]} fitsKeyWords
 * @param {Number} minZoom -2 is half size, 1 is 1:1
 */
function createJoinImage(refView, joinRect, overlap, bmp, title, fitsKeyWords, minZoom) {

    // Create the new image and copy the samples from refView to it
    let maskSamples = new Float32Array(joinRect.area);
    let overlapMask = overlap.getFullImageMask();
    overlapMask.getSamples(maskSamples, joinRect);
    overlapMask.free();
    
    createImageFromRefAndBitmap(refView, joinRect, maskSamples,
            bmp, title, fitsKeyWords, minZoom);
}
