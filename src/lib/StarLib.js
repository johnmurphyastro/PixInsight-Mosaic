/* global ImageWindow, ChannelExtraction, UndoFlag_NoSwapFile, MultiscaleLinearTransform */

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
    
    /** {Image} bitmap indicates were ref & tgt images overlap */
    this.starRegionMask = null;
    /** {Rect} starRegionMask bounding box */
    this.overlapBox = null;
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
     * @param {Rect} previewArea 
     * @param {Number} logSensitivity
     * @param {StarCache} starCache
     * @return {StarCache} new star cache
     */
    this.detectStars = function (refView, tgtView, previewArea, logSensitivity, starCache) {
        this.nChannels = refView.image.isColor ? 3 : 1;
        
        // let the StarCache know about any relevant input parameter changes
        starCache.setUserInputData(refView.fullId, tgtView.fullId, previewArea, logSensitivity);
        
        // StarRegionMask
        if (starCache.starRegionMask === null || starCache.overlapBox === null){
            // Create ref/tgt overlap bitmap (starRegionMask) and its bounding box (ovelapBox)
            cacheStarRegionMask(refView.image, tgtView.image, previewArea, starCache);
        }
        this.starRegionMask = starCache.starRegionMask;
        this.overlapBox = starCache.overlapBox;
         
        console.writeln("<b><u>Detecting stars</u></b>");
        processEvents();
        
        let detectStarTime = new Date().getTime();
        // Reference image stars
        if (starCache.refColorStars === null){
            starCache.allStars = null;
            starCache.refColorStars = [];
            for (let c = 0; c < this.nChannels; c++) {
                let stars = findStars(refView, this.starRegionMask, logSensitivity, c);
                starCache.refColorStars.push(stars);
                
                console.writeln("Reference[", c, "] detected ", stars.length, " stars");
                processEvents();
            }
        }
        this.refColorStars = starCache.refColorStars;
        
        // Target image stars
        if (starCache.tgtColorStars === null){
            starCache.allStars = null;
            starCache.tgtColorStars = [];
            for (let c = 0; c < this.nChannels; c++) {
                let stars = findStars(tgtView, this.starRegionMask, logSensitivity, c);
                starCache.tgtColorStars.push(stars);
                
                console.writeln("Target[", c, "] detected ", stars.length, " stars");
                processEvents();
            }
        }
        this.tgtColorStars = starCache.tgtColorStars;
        
        // Reference and target stars, sorted by star flux
        if (starCache.allStars === null){
            starCache.allStars = combienStarArrays(starCache.refColorStars, starCache.tgtColorStars);
        }
        this.allStars = starCache.allStars;

        console.writeln("\n<b>Star cache:</b>\n" + starCache.getStatus() + 
                "\n    (" + getElapsedTime(detectStarTime) + ")\n");
        processEvents();
    };
    
    /**
     * 
     * @param {Image} refImg
     * @param {Image} tgtImg
     * @param {Number} upperLimit Only use stars within camera's linear range
     * @returns {StarPairs[]} Array of StarPairs for all color channels
     */
    this.getColorStarPairs = function(refImg, tgtImg, upperLimit){
        let colorStarPairs = [];
        let nChannels = refImg.isColor ? 3 : 1;
        for (let channel=0; channel < nChannels; channel++){
            let starPairs = findMatchingStars(refImg, tgtImg, channel, upperLimit);
            colorStarPairs.push(starPairs);
        }
        return colorStarPairs;
    };  
    
    /** Private
     * Create bitmap image with overlapping region set to 1
     * @param {Image} refImage
     * @param {Image} tgtImage
     * @param {Rect} previewArea
     * @param {StarCache} starCache
     */
    let cacheStarRegionMask = function (refImage, tgtImage, previewArea, starCache) {
        const startTime = new Date().getTime();
        console.writeln("<b><u>Calculating overlap</u></b>");
        processEvents();
        
        let xMin = 0;
        let xMax = refImage.width;
        let yMin = 0;
        let yMax = refImage.height;  
        let width = refImage.width;
        if (previewArea !== null){
            xMin = previewArea.x0;
            xMax = previewArea.x1;
            yMin = previewArea.y0;
            yMax = previewArea.y1;  
            width = previewArea.width;
        } 
        
        const updateInterval = width / 10;
        let xOld = 0;
        let oldTextLength = 0;
        
        let showProgress = function (x){
            let text = "" + Math.trunc(x / width * 100) + "%";
            console.write(getDelStr() + text);
            processEvents();
            oldTextLength = text.length;
            xOld = x;
        };
        let getDelStr = function (){
            let bsp = "";
            for (let i = 0; i < oldTextLength; i++) {
                bsp += "<bsp>";
            }
            return bsp;
        };
        
        let mask = new Image(refImage.width, refImage.height, 1);
        mask.fill(0);
        // Overlap bounding box coordinates
        let x0 = Number.POSITIVE_INFINITY;
        let x1 = Number.NEGATIVE_INFINITY;
        let y0 = Number.POSITIVE_INFINITY;
        let y1 = Number.NEGATIVE_INFINITY;
        // Create a mask to restrict the star detection to the overlapping area and previewArea
        for (let x = xMin; x < xMax; x++) {
            for (let y = yMin; y < yMax; y++) {
                let isOverlap = true;
                for (let c = self.nChannels - 1; c > -1; c--) {
                    if (tgtImage.sample(x, y, c) === 0 || refImage.sample(x, y, c) === 0) {
                        isOverlap = false;
                        break;
                    }
                }
                if (isOverlap) {
                    mask.setSample(1, x, y);
                    // Determine bounding box
                    x0 = Math.min(x0, x);
                    x1 = Math.max(x1, x);
                    y0 = Math.min(y0, y);
                    y1 = Math.max(y1, y);
                }
            }
            if (x > xOld + updateInterval){
                showProgress(x);
            }
        }
        if (x0 !== Number.POSITIVE_INFINITY){
            starCache.setOverlapBox(new Rect(x0, y0, x1+1, y1+1));
        } else {
            starCache.setOverlapBox(null);
        }
        
        starCache.starRegionMask = mask;
        console.write(getDelStr());   // remove 100% from console
        console.writeln(getElapsedTime(startTime) + "\n");
    };
    
    /**
     * Private
     * @param {View} view
     * @param {Image} starRegionMask Bitmap represents overlapping region
     * @param {Number} logSensitivity
     * @param {Number} channel
     * @returns {Star[]}
     */
    let findStars = function(view, starRegionMask, logSensitivity, channel){
        const title = "TMP_ChannelExtraction";
        const useColorManagement = true;
        const isColor = view.image.isColor;
        let imgWindow = null;
        let starImage;
        if (isColor){
            if (useColorManagement){
                // Extract the specified color channel from both target and reference images
                // Slightly more accurate, but slow
                // ChannelExtraction creates a new B&W image for the extracted channel
                let P = new ChannelExtraction;
                P.colorSpace = ChannelExtraction.prototype.RGB;
                P.sampleFormat = ChannelExtraction.prototype.SameAsSource;
                P.channels = [// enabled, id
                    [channel % 3 === 0, title],
                    [channel % 3 === 1, title],
                    [channel % 3 === 2, title]
                ];
                P.executeOn(view);
                imgWindow = ImageWindow.windowById( title );
                starImage = imgWindow.mainView.image;
            } else {
                // Dont color manage to increase speed
                // The extra error when the scale is calculated is small:
                // Example: slow method gives 1.100000299505084, this method: 1.1003654077279212
                // Create grey scale 32bit floating point images
                let width = view.image.width;
                let height = view.image.height;
                starImage = new Image(width, height, 1);
                for (let x = width - 1; x !== 0; x-- ){
                    for (let y = height - 1; y !== 0; y--){
                        starImage.setSample(view.image.sample(x, y, channel), x, y);
                    }
                }
            }
        } else {
            // Input images are B&W so we can use them directly
            starImage = view.image;
        }

        // Detect stars in target and reference images
        let starDetector = new StarDetector();
        starDetector.mask = starRegionMask;
        starDetector.sensitivity = Math.pow(10.0, logSensitivity);
        starDetector.upperLimit = 1;
        // Noise reduction affects the accuracy of the photometry
        starDetector.applyHotPixelFilterToDetectionImage = false;
        self.bkgDelta = starDetector.bkgDelta;
        let stars = starDetector.stars(starImage);

        if (useColorManagement && isColor){
            // We must close the temporary windows we created
            imgWindow.forceClose();
        }
        return stars;
    };
    
    /**
     * Finds the stars that exist in both images that have no pixel above upperLimit
     * @param {Image} refImg
     * @param {Image} tgtImg 
     * @param {Number} channel
     * @param {Number} upperLimit Reject stars with one or more pixels greater than this.
     * @returns {StarPairs} Matching star pairs. All star pixels are below the upperLimit.
     */
    let findMatchingStars = function (refImg, tgtImg, channel, upperLimit) {
        let refStars = self.refColorStars[channel];
        let tgtStars = self.tgtColorStars[channel];
        let createKey = function (star) {
            return "" + Math.round(star.pos.x) + "," + Math.round(star.pos.y);
        };

        let withinLimit = function (image, star, upperLimit) {
            let r = Math.sqrt(star.size) / 2;
            let sx = star.pos.x;
            let sy = star.pos.y;
            let rect = new Rect(sx - r, sy - r, sx + r, sy + r);
            return image.maximum(rect, channel, channel) < upperLimit;
        };

        let starMap = new Map();
        for (let star of refStars) {
            if (withinLimit(refImg, star, upperLimit)) {
                starMap.set(createKey(star), star);
            }
        }

        // Find stars that are in both images, using a search radius of 1 pixel
        let starPairArray = [];
        for (let tgtStar of tgtStars) {
            if (withinLimit(tgtImg, tgtStar, upperLimit)) {
                const key = createKey(tgtStar);
                if (starMap.has(key)) {
                    starPairArray.push(new StarPair(starMap.get(key), tgtStar));
                }
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
    let combienStarArrays = function (refColorStars, tgtColorStars){
        /**
         * @param {Star} star
         * @returns {String}
         */
        let starToKey = function(star){
            return "" + star.pos.x + "," + star.pos.y;
        };
        /**
         * @param {Map} starMap
         * @param {Star[]} stars
         */
        let addFirstArray = function (starMap, stars) {
            for (let star of stars) {
                starMap.set(starToKey(star), star);
            }
        };
        /**
         * @param {Map} starMap
         * @param {Star[]} stars
         */
        let addStars = function(starMap, stars){
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
        let getSortedStars = function(starMap){
            let stars = [];
            for (let star of starMap.values()){
                stars.push(star);
            }
            return stars.sort((a, b) => b.flux - a.flux);
        };
        
        // Add all the stars to a map to reject duplicates at the same coordinates
        let starMap = new Map();
        addFirstArray(starMap, refColorStars[0]);
        const nChannels = refColorStars.length;
        for (let c = 1; c < nChannels; c++) {
            addStars(starMap, refColorStars[c]);
        }
        for (let c = 0; c < nChannels; c++) {
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
 * @param {String} refView
 * @param {String} tgtView
 * @param {Number} height
 * @param {StarPairs[]} colorStarPairs StarPairs for L or R,G,B
 * @param {PhotometricMosaicData} data User settings used to create FITS header
 * @returns {Boolean} True if graph was displayed
 */
function displayStarGraph(refView, tgtView, height, colorStarPairs, data){
    /**
     * @param {View} refView
     * @param {View} tgtView
     * @param {ImageWindow} graphWindow Graph window
     * @param {StarPairs[]} colorStarPairs StarPairs for each color channel
     * @param {PhotometricMosaicData} data User settings used to create FITS header
     * @return {undefined}
     */
    let starGraphFitsHeader = function (refView, tgtView, graphWindow, colorStarPairs, data){
        let view = graphWindow.mainView;
        let nColors = colorStarPairs.length;
        view.beginProcess(UndoFlag_NoSwapFile); // don't add to undo list
        let keywords = graphWindow.keywords;
        keywords.push(new FITSKeyword("COMMENT", "", "Ref: " + refView.fullId));
        keywords.push(new FITSKeyword("COMMENT", "", "Tgt: " + tgtView.fullId));
        keywords.push(new FITSKeyword("COMMENT", "", "StarDetection: " + data.logStarDetection));
        keywords.push(new FITSKeyword("COMMENT", "", "LinearRange: " + data.rejectHigh));
        keywords.push(new FITSKeyword("COMMENT", "", "OutlierRemoval: " + data.outlierRemoval));
        let maxErr = Number.NEGATIVE_INFINITY;
        let errStar = null;
        for (let c = 0; c < nColors; c++){
            let starPairs = colorStarPairs[c];
            let linearFit = starPairs.linearFitData;
            let comment = "Scale[" + c + "]: " + linearFit.m.toPrecision(5) + 
                    " (" + starPairs.starPairArray.length + " stars)";
            keywords.push(new FITSKeyword("COMMENT", "", comment));

            for (let starPair of starPairs.starPairArray){
                // y = ref; x = tgt
                let y = eqnOfLineCalcY(starPair.tgtStar.flux, linearFit.m, linearFit.b);
                let dif = Math.abs(y - starPair.refStar.flux);
                if (dif > maxErr){
                    maxErr = dif;
                    errStar = starPair.tgtStar;
                }
            }
        }
        if (maxErr > Number.NEGATIVE_INFINITY){
            let text = "" + maxErr.toPrecision(5) + 
                    " at (" + errStar.pos.x + ", " + errStar.pos.y + ")";
            keywords.push(new FITSKeyword("COMMENT", "", "Max error: " + text));
            console.writeln("Photomertry maximum error: " + text);
        }
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
    let drawStarLineAndPoints = function (graph, lineColor, starPairs, pointColor){
        let linearFit = starPairs.linearFitData;
        graph.drawLine(linearFit.m, linearFit.b, lineColor);
        for (let starPair of starPairs.starPairArray){
            graph.drawPoint(starPair.tgtStar.flux, starPair.refStar.flux, pointColor);
        }
    };
    
    let targetName = tgtView.fullId;
    let referenceName = refView.fullId;
    let imageWindow = null;
    let windowTitle = WINDOW_ID_PREFIX() + targetName + "__Photometry";
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
        imageWindow = graphWithAxis.createWindow(windowTitle, false);
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
        imageWindow = graphWithAxis.createWindow(windowTitle, true);
    }
    starGraphFitsHeader(refView, tgtView, imageWindow, colorStarPairs, data);
    imageWindow.show();
    imageWindow.zoomToFit();
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
    let createBitmap = function(overlapBox){
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
    let createGraphics = function(bitmap, color){
        let g = new VectorGraphics(bitmap);
        g.antialiasing = false;
        g.pen = new Pen(color);
        return g;
    };
    
    let overlapBox = detectedStars.overlapBox;
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
    keywords.push(new FITSKeyword("COMMENT", "", "Ref: " + refView.fullId));
    keywords.push(new FITSKeyword("COMMENT", "", "Tgt: " + targetId));
    keywords.push(new FITSKeyword("COMMENT", "", "StarDetection: " + data.logStarDetection));
    keywords.push(new FITSKeyword("COMMENT", "", "LinearRange: " + data.rejectHigh));
    keywords.push(new FITSKeyword("COMMENT", "", "OutlierRemoval: " + data.outlierRemoval));

    let title = WINDOW_ID_PREFIX() + targetId + "__PhotometryStars";
    createDiagnosticImage(refView, bmp, detectedStars, title, keywords, 1);
}

/**
 * Display the detected stars as squares.
 * Each square is the star's photometry background bounding box.
 * The new image is limited to the overlap area.
 * @param {View} refView Used to create background image
 * @param {StarsDetected} detectedStars
 * @param {String} targetId Used to create ImageWindow title
 * @param {Number} limitMaskStarsPercent
 * @param {String} postfix Used to create ImageWindow title
 * @param {PhotometricMosaicData} data User settings used to create FITS header
 */
function displayDetectedStars(refView, detectedStars, targetId, limitMaskStarsPercent, 
        postfix, data) {
    let overlapBox = detectedStars.overlapBox;
    let offsetX = -overlapBox.x0;
    let offsetY = -overlapBox.y0;
    let bmp = new Bitmap(overlapBox.width, overlapBox.height);
    bmp.fill(0x00000000);
    let G = new VectorGraphics(bmp);
    G.pen = new Pen(0xffff0000);
    G.antialiasing = false;
    
    let allStars = detectedStars.allStars;
    let firstNstars;
    if (limitMaskStarsPercent < 100){
        firstNstars = Math.floor(allStars.length * limitMaskStarsPercent / 100);
    } else {
        firstNstars = allStars.length;
    }
    
    for (let i = 0; i < firstNstars; ++i){
        let star = allStars[i];
        let s = Math.sqrt(star.size) + detectedStars.bkgDelta * 2;
        let rect = new Rect(s, s);
        rect.center = new Point(star.pos.x + offsetX, star.pos.y + offsetY);
        G.strokeRect(rect);
    }
    G.end();

    let keywords = [];
    keywords.push(new FITSKeyword("COMMENT", "", "Ref: " + refView.fullId));
    keywords.push(new FITSKeyword("COMMENT", "", "Tgt: " + targetId));
    keywords.push(new FITSKeyword("COMMENT", "", "StarDetection: " + data.logStarDetection));

    let title = WINDOW_ID_PREFIX() + targetId + postfix;
    createDiagnosticImage(refView, bmp, detectedStars, title, keywords, 1);
}

/**
 * Display the masked stars as circles
 * The new image is limited to the overlap area.
 * @param {View} refView Used to create background image
 * @param {StarsDetected} detectedStars
 * @param {String} targetId Used to create ImageWindow title
 * @param {Number} limitMaskStarsPercent
 * @param {Number} radiusMult
 * @param {Number} radiusAdd
 * @param {Boolean} antialias
 * @param {String} postfix Used to create ImageWindow title
 * @param {PhotometricMosaicData} data User settings used to create FITS header
 */
function displayMaskStars(refView, detectedStars, targetId, limitMaskStarsPercent, 
        radiusMult, radiusAdd, antialias, postfix, data) {
    let overlapBox = detectedStars.overlapBox;
    let offsetX = -overlapBox.x0;
    let offsetY = -overlapBox.y0;
    let bmp = new Bitmap(overlapBox.width, overlapBox.height);
    bmp.fill(0x00000000);
    let G = new VectorGraphics(bmp);
    G.pen = new Pen(0xffff0000);
    G.antialiasing = antialias;
    
    let allStars = detectedStars.allStars;
    let firstNstars;
    if (limitMaskStarsPercent < 100){
        firstNstars = Math.floor(allStars.length * limitMaskStarsPercent / 100);
    } else {
        firstNstars = allStars.length;
    }
    
    for (let i = 0; i < firstNstars; ++i){
        let star = allStars[i];
        // size is the area. sqrt gives box side length. Half gives circle radius
        let radius = Math.sqrt(star.size)/2;
        let x = star.pos.x + offsetX;
        let y = star.pos.y + offsetY;
        G.strokeCircle(x, y, radius * radiusMult + radiusAdd);
    }
    G.end();

    let title = WINDOW_ID_PREFIX() + targetId + postfix;
    
    let keywords = [];
    keywords.push(new FITSKeyword("COMMENT", "", "Ref: " + refView.fullId));
    keywords.push(new FITSKeyword("COMMENT", "", "Tgt: " + targetId));
    keywords.push(new FITSKeyword("COMMENT", "", "StarDetection: " + data.logStarDetection));
    keywords.push(new FITSKeyword("COMMENT", "", "LimitStarsPercent: " + limitMaskStarsPercent));
    keywords.push(new FITSKeyword("COMMENT", "", "RadiusMultiply: " + radiusMult));
    keywords.push(new FITSKeyword("COMMENT", "", "RadiusAdd: " + radiusAdd));
    
    createDiagnosticImage(refView, bmp, detectedStars, title, keywords, 1);
}

/**
 * @param {View} tgtView
 * @param {StarsDetected} detectedStars
 * @param {Number} limitMaskStarsPercent
 * @param {Number} radiusMult
 * @param {Number} radiusAdd
 * @param {PhotometricMosaicData} data User settings used to create FITS header
 */
function displayMask(tgtView, detectedStars, limitMaskStarsPercent, radiusMult, radiusAdd, data){
    let postfix = "Mask";
    let title = WINDOW_ID_PREFIX() + tgtView.fullId + "__" + limitMaskStarsPercent + "_" + postfix;
    let bmp = new Bitmap(tgtView.image.width, tgtView.image.height);
    bmp.fill(0xffffffff);
    
    let firstNstars;
    if (limitMaskStarsPercent < 100){
        firstNstars = Math.floor(detectedStars.allStars.length * limitMaskStarsPercent / 100);
    } else {
        firstNstars = detectedStars.allStars.length;
    }
    
    let overlapBox = detectedStars.overlapBox;
    let clipRect = new Rect(overlapBox);
    clipRect.deflateBy(5); // to allow for the 3 pixel soft edge growth
    let G = new VectorGraphics(bmp);
    G.antialiasing = true;
    G.brush = new Brush();
    G.clipRect = clipRect;
    
    for (let i = 0; i < firstNstars; ++i){
        let star = detectedStars.allStars[i];
        // size is the area. sqrt gives box side length. Half gives circle radius
        let radius = (Math.sqrt(star.size)/2) * radiusMult + radiusAdd;
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
    let starRegionMask = detectedStars.starRegionMask;
    let minX = Math.max(0, overlapBox.x0 - 10);
    let minY = Math.max(0, overlapBox.y0 - 10);
    let maxX = Math.min(bmp.width, overlapBox.x1 + 10);
    let maxY = Math.min(bmp.height, overlapBox.y1 + 10);
    for (let x = minX; x < maxX; x++){
        for (let y = minY; y < maxY; y++){
            if (starRegionMask.sample(x, y) === 0 && view.image.sample(x, y) !== 0){
                view.image.setSample(0, x, y);
            }
        }
    }

    let keywords = [];
    keywords.push(new FITSKeyword("COMMENT", "", "Ref: " + data.referenceView.fullId));
    keywords.push(new FITSKeyword("COMMENT", "", "Tgt: " + tgtView.fullId));
    keywords.push(new FITSKeyword("COMMENT", "", "StarDetection: " + data.logStarDetection));
    keywords.push(new FITSKeyword("COMMENT", "", "LimitStarsPercent: " + limitMaskStarsPercent));
    keywords.push(new FITSKeyword("COMMENT", "", "RadiusMultiply: " + radiusMult));
    keywords.push(new FITSKeyword("COMMENT", "", "RadiusAdd: " + radiusAdd));
    
    w.keywords = keywords;
    view.endProcess();
    w.show();
}

/**
 * Create an image that contains the overlap bounding box.
 * The background is copied from refView, but pixels outside the overlap are set
 * to black. The bitmap image is copied on top of the background. 
 * This bitmap image must be the same size as the overlap bounding box.
 * @param {Image} refView Used to create background image
 * @param {Bitmap} bmp The bitmap image to lay on top of the background image
 * @param {StarsDetected} detectedStars For overlayBox and starRegionMask
 * @param {String} title Window title
 * @param {FITSKeyword[]} fitsKeyWords
 * @param {Number} minZoom -2 is half size, 1 is 1:1
 */
function createDiagnosticImage(refView, bmp, detectedStars, title, fitsKeyWords, minZoom) {
    /**
     * Get all the samples from the image that are within the overlapBox rectangle.
     * @param {Image} image Return subset of samples from this image
     * @param {Array} mask If mask is zero, set output sample to zero
     * @param {Rect} overlapBox Get samples from within this area
     * @param {Number} c channel
     * @returns {Array} Samples
     */
    let getOverlapSamples = function (image, mask, overlapBox, c) {
        let refSamples = [];
        image.getSamples(refSamples, overlapBox, c);
        for (let i = mask.length - 1; i > -1; i--) {
            if (mask[i] === 0) {
                refSamples[i] = 0;
            }
        }
        return refSamples;
    };
    
    // Create the new image and copy the samples from refView to it
    let overlapBox = detectedStars.overlapBox;
    let starRegionMask = detectedStars.starRegionMask;
    let maskSamples = [];
    starRegionMask.getSamples(maskSamples, overlapBox);
    let rect = new Rect(overlapBox.width, overlapBox.height);
    
    // If read only, we can use the image directly.
    // If write access, we need to access it via the view.
    let refImage = refView.image;
    //  Width, height, n channels, bitsPerSample, float, color, title
    let w = new ImageWindow(bmp.width, bmp.height, 3, 16, false, true, title);
    let view = w.mainView;
    view.beginProcess(UndoFlag_NoSwapFile);
    if (refImage.isColor){
        for (let c = 0; c < 3; c++){
            let refSamples = getOverlapSamples(refImage, maskSamples, overlapBox, c);
            view.image.setSamples(refSamples, rect, c);
        }
    } else {
        let refSamples = getOverlapSamples(refImage, maskSamples, overlapBox, 0);
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
