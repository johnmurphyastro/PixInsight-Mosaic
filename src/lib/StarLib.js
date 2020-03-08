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
    
    this.getTgtFlux = function(){
        return getFlux(tgtStar);
    };
    this.getRefFlux = function(){
        return getFlux(refStar);
    };
    this.getTgtX = function(){
        return tgtStar.pos.x;
    };
    this.getTgtY = function(){
        return tgtStar.pos.y;
    };
    this.getRefX = function(){
        return refStar.pos.x;
    };
    this.getRefY = function(){
        return refStar.pos.y;
    };
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
 * The StarDetector does not subtract the background from the star, so we neeed
 * to do this here
 * @param {Star} star
 * @returns {Number} Star flux corrected for background level
 */
function getFlux(star) {
    return star.flux - star.bkg * star.size;
};

/**
 * 
 * @returns {StarsDetected}
 */
function StarsDetected(){
    this.nChannels = 1;
    this.starRegionMask = null;
    /** color array of Star[] */
    this.refColorStars = [];
    /** color array of Star[] */
    this.tgtColorStars = [];
    /** Star[] */
    this.allStars = null;
    
    /**
     * @param {View} refView
     * @param {View} tgtView
     * @param {Rect} regionOfInterest 
     * @param {Number} logSensitivity
     */
    this.detectStars = function (refView, tgtView, regionOfInterest, logSensitivity) {
        this.nChannels = refView.image.isColor ? 3 : 1;
        this.starRegionMask = this.createStarRegionMask(refView.image, tgtView.image, regionOfInterest);
        // Detect stars in both ref and tgt images in all channels
        for (let c = 0; c < this.nChannels; c++) {
            this.refColorStars.push(this.findStars(refView, logSensitivity, c));
            this.tgtColorStars.push(this.findStars(tgtView, logSensitivity, c));
        }

        let combienStars = new CombienStarArrays();
        combienStars.addFirstArray(this.refColorStars[0]);
        for (let c = 1; c < this.nChannels; c++) {
            combienStars.addStars(this.refColorStars[c]);
        }
        for (let c = 0; c < this.nChannels; c++) {
            combienStars.addStars(this.tgtColorStars[c]);
        }
        this.allStars = combienStars.getSortedStars();
    };
    
    /** Private
     * Create bitmap image with overlapping region set to 1
     * @param {Image} refImage
     * @param {Image} tgtImage
     * @param {Rect} regionOfInterest
     * @param {Rect} regionOfInterest
     * @returns {Image} A image mask for the overlapping region
     */
    this.createStarRegionMask = function (refImage, tgtImage, regionOfInterest) {
        let mask = new Image(refImage.width, refImage.height, 1);
        mask.fill(0);

        // Create a mask to restrict the star detection to the overlapping area and previewArea
        let xMin = regionOfInterest.x0;
        let xMax = regionOfInterest.x1;
        let yMin = regionOfInterest.y0;
        let yMax = regionOfInterest.y1;
        for (let x = xMin; x < xMax; x++) {
            for (let y = yMin; y < yMax; y++) {
                let isOverlap = true;
                for (let c = this.nChannels - 1; c >= 0; c--) {
                    if (tgtImage.sample(x, y, c) === 0 || refImage.sample(x, y, c) === 0) {
                        isOverlap = false;
                        break;
                    }
                }
                if (isOverlap) {
                    mask.setSample(1, x, y);
                }
            }
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
    this.findStars = function(view, logSensitivity, channel){
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
        starDetector.mask = this.starRegionMask;
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
}

/**
 * Combien star arrays removing duplicate stars (keep star with maximum flux)
 * @param {Number} stars
 */
function CombienStarArrays(stars){
    this.starMap = new Map();
    
    /**
     * @param {Star[]} stars
     */
    this.addFirstArray = function (stars) {
        for (let star of stars) {
            this.starMap.set(this.starToKey(star), star);
        }
    };
    
    /**
     * @param {Star[]} stars
     */
    this.addStars = function(stars){
        for (let star of stars){
            // keep star with maximum flux
            let key = this.starToKey(star);
            let mapStar = this.starMap.get(key);
            if (mapStar === undefined || mapStar.flux < star.flux){
                this.starMap.set(key, star);
            }
        }
    };
    
    /**
     * @returns {Star[]} All stars, sorted by brightness (brightest first)
     */
    this.getSortedStars = function(){
        let stars = [];
        for (let star of this.starMap.values()){
            stars.push(star);
        }
        return stars.sort((a, b) => b.flux - a.flux);
    };
    
    /** Private function
     * @param {Star} star
     * @returns {String}
     */
    this.starToKey = function(star){
        return "" + star.pos.x + "," + star.pos.y;
    };
    
    /** Private functin
     * @param {Star} star1
     * @param {Star} star2
     * @returns {Star} The brightest of the two stars
     */
    this.brightestStar = function(star1, star2){
        return star1.flux > star2.flux ? star1 : star2;
    };
}

/**
 * Finds the stars that exist in both images that have no pixel above upperLimit
 * @param {Image} refImg
 * @param {Star[]} refStars Stars detected in reference image.
 * @param {Image} tgtImg 
 * @param {Star[]} tgtStars Stars detected in target image.
 * @param {Number} channel
 * @param {Number} upperLimit Reject stars with one or more pixels greater than this.
 * @returns {StarPairs} Matching star pairs. All star pixels are below the upperLimit.
 */
function findMatchingStars(refImg, refStars, tgtImg, tgtStars, channel, upperLimit){
    let createKey = function(star){
        return "" + Math.round(star.pos.x) + "," + Math.round(star.pos.y);
    };
    
    let withinLimit = function(image, star, upperLimit){
        let r = Math.sqrt(star.size)/2;
        let sx = star.pos.x;
        let sy = star.pos.y;
        let rect = new Rect(sx - r, sy - r, sx + r, sy + r);
        return image.maximum(rect, channel, channel) < upperLimit;
    };
    
    let starMap = new Map();
    for (let star of refStars){
        if (withinLimit(refImg, star, upperLimit)){
            starMap.set(createKey(star), star);
        }
    }
    
    // Find stars that are in both images, using a search radius of 1 pixel
    let starPairArray = [];
    for (let tgtStar of tgtStars){
        if (withinLimit(tgtImg, tgtStar, upperLimit)){
            const key = createKey(tgtStar);
            if (starMap.has(key)){
                starPairArray.push(new StarPair(starMap.get(key), tgtStar));
            }
        }
    }
    return new StarPairs(starPairArray);
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
            this.maxRefFlux = Math.max(this.maxRefFlux, getFlux(starPair.refStar));
            this.maxTgtFlux = Math.max(this.maxTgtFlux, getFlux(starPair.tgtStar));
            this.minRefFlux = Math.min(this.minRefFlux, getFlux(starPair.refStar));
            this.minTgtFlux = Math.min(this.minTgtFlux, getFlux(starPair.tgtStar));
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
    
    imageWindow.show();
}

/**
 * Display the detected stars as circles within a mask image
 * @param {View} view Get the dimensions from this image
 * @param {StarPair[]} starPairArray Detected stars
 * @param {Number} channel
 * @param {Boolean} isColor
 */
function displayDetectedStars(view, starPairArray, channel, isColor) {
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
        graph.drawPoint(getFlux(starPair.tgtStar), getFlux(starPair.refStar), pointColor);
    }
}
