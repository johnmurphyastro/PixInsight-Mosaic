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

function StarCache() {
    // Is cache valid parameters
    this.refId = null;
    this.tgtId = null;
    this.regionOfInterest = null;
    this.logSensitivity = Number.NaN;

    // Stored data
    this.overlapBox = null;
    this.starRegionMask = null;
    /** color array of Star[] */
    this.refColorStars = null;
    /** color array of Star[] */
    this.tgtColorStars = null;
    /** Star[] */
    this.allStars = null;

    /**
     * @param {String} refId
     * @param {String} tgtId
     * @param {Rect} regionOfInterest
     * @param {Number} logSensitivity
     */
    this.setIsValidParameters = function (refId, tgtId, regionOfInterest, logSensitivity) {
        this.refId = refId;
        this.tgtId = tgtId;
        this.regionOfInterest = regionOfInterest;
        this.logSensitivity = logSensitivity;
    };
    
    /**
     * @param {String} refId
     * @param {String} tgtId
     * @param {Rect} regionOfInterest
     * @param {Number} logSensitivity
     * @returns {Boolean}
     */
    this.isValid = function (refId, tgtId, regionOfInterest, logSensitivity) {
        return refId === this.refId &&
                tgtId === this.tgtId &&
                logSensitivity === this.logSensitivity &&
                regionOfInterest.x0 === this.regionOfInterest.x0 && 
                regionOfInterest.x1 === this.regionOfInterest.x1 &&
                regionOfInterest.y0 === this.regionOfInterest.y0 && 
                regionOfInterest.y1 === this.regionOfInterest.y1;
    };
    
    /**
     * @param {Rect} overlapBox
     * @param {Image} starRegionMask
     * @param {Star[][]} refColorStars Color array of Star[]
     * @param {Star[][]} tgtColorStars Color array of Star[]
     * @param {Star[]} allStars
     * @returns {undefined}
     */
    this.setData = function (overlapBox, starRegionMask, refColorStars, tgtColorStars, allStars){
        this.overlapBox = overlapBox;
        this.starRegionMask = starRegionMask;
        this.refColorStars = refColorStars;
        this.tgtColorStars = tgtColorStars;
        this.allStars = allStars;
    };
    
    /**
     * @returns {String} Cache content details
     */
    this.getStatus = function(){
        let allStarsN = this.allStars.length;
        let nChannels = this.refColorStars.length;
        let nRefStars = 0;
        let nTgtStars = 0;
        for (let c=0; c<nChannels; c++){
            nRefStars += this.refColorStars[c].length;
            nTgtStars += this.tgtColorStars[c].length;
        }
        return "    Detected stars: " + allStarsN +
                "\n    Reference stars: " + nRefStars +
                "\n    Target stars: " + nTgtStars;
    }
}

/**
 * 
 * @returns {StarsDetected}
 */
function StarsDetected(){
    this.nChannels = 1;
    this.overlapBox = null;
    this.starRegionMask = null;
    /** color array of Star[] */
    this.refColorStars = [];
    /** color array of Star[] */
    this.tgtColorStars = [];
    /** Star[] */
    this.allStars = null;
    
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
        let regionOfInterest = previewArea === null ? refView.image.bounds : previewArea;
        if (starCache !== null && starCache.isValid(refView.fullId, tgtView.fullId, regionOfInterest, logSensitivity)){
            this.starRegionMask = starCache.starRegionMask;
            this.overlapBox = starCache.overlapBox;
            this.refColorStars = starCache.refColorStars;
            this.tgtColorStars = starCache.tgtColorStars;
            this.allStars = starCache.allStars;
            console.writeln("Using star cache:\n" + starCache.getStatus() + "\n");
            return starCache;
        } else {
            let detectStarTime = new Date().getTime();
            this.starRegionMask = createStarRegionMask(refView.image, tgtView.image, regionOfInterest);
            // Detect stars in both ref and tgt images in all channels
            for (let c = 0; c < this.nChannels; c++) {
                this.refColorStars.push(findStars(refView, logSensitivity, c));
                this.tgtColorStars.push(findStars(tgtView, logSensitivity, c));
            }
            this.allStars = combienStarArrays();
            
            let newStarCache = new StarCache();
            newStarCache.setIsValidParameters(refView.fullId, tgtView.fullId, regionOfInterest, logSensitivity);
            newStarCache.setData(this.overlapBox, this.starRegionMask, 
                    this.refColorStars, this.tgtColorStars, this.allStars);
            console.writeln("Caching stars:\n" + newStarCache.getStatus() + 
                    "\n    (" + getElapsedTime(detectStarTime) + ")\n");
            return newStarCache;
        }
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
     * @param {Rect} regionOfInterest
     * @param {Rect} regionOfInterest
     * @returns {Image} A image mask for the overlapping region
     */
    let createStarRegionMask = function (refImage, tgtImage, regionOfInterest) {
        let mask = new Image(refImage.width, refImage.height, 1);
        mask.fill(0);
        // Overlap bounding box coordinates
        let x0 = Number.POSITIVE_INFINITY;
        let x1 = Number.NEGATIVE_INFINITY;
        let y0 = Number.POSITIVE_INFINITY;
        let y1 = Number.NEGATIVE_INFINITY;
        // Create a mask to restrict the star detection to the overlapping area and previewArea
        let xMin = regionOfInterest.x0;
        let xMax = regionOfInterest.x1;
        let yMin = regionOfInterest.y0;
        let yMax = regionOfInterest.y1;
        for (let x = xMin; x < xMax; x++) {
            for (let y = yMin; y < yMax; y++) {
                let isOverlap = true;
                for (let c = self.nChannels - 1; c >= 0; c--) {
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
        }
        if (x0 !== Number.POSITIVE_INFINITY){
            self.overlapBox = new Rect(x0, y0, x1+1, y1+1);
        } else {
            self.overlapBox = null;
        }
        
        return mask;
    };
    
    /**
     * Private
     * @param {View} view
     * @param {Number} logSensitivity
     * @param {Number} channel
     * @returns {unresolved}
     */
    let findStars = function(view, logSensitivity, channel){
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
        starDetector.mask = self.starRegionMask;
        starDetector.sensitivity = Math.pow(10.0, logSensitivity);
        starDetector.upperLimit = 1;
        starDetector.applyHotPixelFilterToDetectionImage = true;
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
     * @returns {Star[]} All stars, sorted by brightness (brightest first)
     */
    let combienStarArrays = function (){
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
        addFirstArray(starMap, self.refColorStars[0]);
        for (let c = 1; c < self.nChannels; c++) {
            addStars(starMap, self.refColorStars[c]);
        }
        for (let c = 0; c < self.nChannels; c++) {
            addStars(starMap, self.tgtColorStars[c]);
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
 * @returns {undefined}
 */
function displayStarGraph(refView, tgtView, height, colorStarPairs){
    /**
     * @param {View} refView
     * @param {View} tgtView
     * @param {ImageWindow} graphWindow Graph window
     * @param {StarPairs[]} colorStarPairs StarPairs for each color channel
     * @return {undefined}
     */
    let starGraphFitsHeader = function (refView, tgtView, graphWindow, colorStarPairs){
        let view = graphWindow.mainView;
        let nColors = colorStarPairs.length;
        view.beginProcess(UndoFlag_NoSwapFile); // don't add to undo list
        let keywords = graphWindow.keywords;
        keywords.push(new FITSKeyword("COMMENT", "", "Ref: " + refView.fullId));
        keywords.push(new FITSKeyword("COMMENT", "", "Tgt: " + tgtView.fullId));
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
        console.warningln("Unable to display graph. No points to display.");
        return;
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
    starGraphFitsHeader(refView, tgtView, imageWindow, colorStarPairs);
    imageWindow.show();
    imageWindow.zoomToFit();
}

/**
 * Display the detected stars as circles within a mask image
 * @param {View} view Get the dimensions from this image
 * @param {StarPair[]} starPairArray Detected stars
 * @param {Number} channel
 * @param {Boolean} isColor
 */
function displayPhotometryStars(view, starPairArray, channel, isColor) {
    let title = WINDOW_ID_PREFIX() + view.fullId;
    switch (channel) {
        case 0:
            if (isColor){
                title += "__RedPhotometry";
            } else {
                title += "__PhotometryStars";
            }
            break;
        case 1:
            title += "__GreenPhotometry";
            break;
        case 2:
            title += "__BluePhotometry";
    }
    let image = view.image;
    let bmp = new Bitmap(image.width, image.height);
    bmp.fill(0xffffffff);
    let G = new VectorGraphics(bmp);
    G.antialiasing = true;
    G.pen = new Pen(0xff000000);
    for (let i = 0; i < starPairArray.length; ++i){
        let starPair = starPairArray[i];
        let tgtStar = starPair.tgtStar;
        let refStar = starPair.refStar;
        let maxSize = Math.max(tgtStar.size,refStar.size);
        let radius = Math.sqrt(maxSize)/2;
        G.strokeCircle(refStar.pos, radius);
    }
    G.end();

    let w = new ImageWindow(bmp.width, bmp.height,
            1, // numberOfChannels
            8, // bitsPerSample
            false, // floatSample
            false, // color
            title);
    w.mainView.beginProcess(UndoFlag_NoSwapFile);
    w.mainView.image.blend(bmp);
    w.mainView.endProcess();
    w.show();
    //w.zoomToFit();
}

/**
 * Display the detected stars as circles within a mask image
 * @param {View} view Get the dimensions from this image
 * @param {Star[]} stars
 */
function displayDetectedStars(view, stars) {
    let title = WINDOW_ID_PREFIX() + view.fullId + "__DetectedStars";
    let image = view.image;
    let bmp = new Bitmap(image.width, image.height);
    bmp.fill(0xffffffff);
    let G = new VectorGraphics(bmp);
    G.antialiasing = true;
    G.pen = new Pen(0xff000000);
    for (let star of stars){
        let radius = Math.sqrt(star.size)/2;
        G.strokeCircle(star.pos, radius);
    }
    G.end();

    let w = new ImageWindow(bmp.width, bmp.height,
            1, // numberOfChannels
            8, // bitsPerSample
            false, // floatSample
            false, // color
            title);
    w.mainView.beginProcess(UndoFlag_NoSwapFile);
    w.mainView.image.blend(bmp);
    w.mainView.endProcess();
    w.show();
    //w.zoomToFit();
}

/**
 * @param {View} view
 * @param {Star[]} allStars
 * @param {Number} limitMaskStarsPercent
 * @param {Number} radiusMult
 * @param {Number} radiusAdd
 * @param {Boolean} fill
 */
function displayMask(view, allStars, limitMaskStarsPercent, radiusMult, radiusAdd, fill){
    let postfix = fill ? "__MosaicMask" : "__MosaicStarsMask";
    let title = WINDOW_ID_PREFIX() + view.fullId + postfix;
    let bmp = new Bitmap(view.image.width, view.image.height);
    bmp.fill(0xffffffff);
    
    let firstNstars;
    if (limitMaskStarsPercent < 100){
        firstNstars = Math.floor(allStars.length * limitMaskStarsPercent / 100);
    } else {
        firstNstars = allStars.length;
    }
    
    let G = new VectorGraphics(bmp);
    G.antialiasing = true;
    if (fill){
        G.brush = new Brush();
    } else {
        G.pen = new Pen(0xff000000);
    }
    for (let i = 0; i < firstNstars; ++i){
        let star = allStars[i];
        let radius = (Math.sqrt(star.size)/2) * radiusMult + radiusAdd;
        if (fill){
            G.fillCircle(star.pos, radius);
        } else {
            G.strokeCircle(star.pos, radius);
        }
    }
    G.end();
    
    if (fill){
        bmp.invert();
    }

    let w = new ImageWindow(bmp.width, bmp.height,
            1, // numberOfChannels
            8, // bitsPerSample
            false, // floatSample
            false, // color
            title);
    w.mainView.beginProcess(UndoFlag_NoSwapFile);
    w.mainView.image.blend(bmp);
    if (fill){
        let P = new MultiscaleLinearTransform;
        P.layers = [// enabled, biasEnabled, bias, noiseReductionEnabled, noiseReductionThreshold, noiseReductionAmount, noiseReductionIterations
            [false, true, 0.000, false, 3.000, 1.00, 1],
            [false, true, 0.000, false, 3.000, 1.00, 1],
            [true, true, 0.000, false, 3.000, 1.00, 1]
        ];
        P.transform = MultiscaleLinearTransform.prototype.StarletTransform;
        P.executeOn(w.mainView, false);
    }
    w.mainView.endProcess();
    w.show();
}
