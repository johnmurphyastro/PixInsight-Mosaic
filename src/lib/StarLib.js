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
 * Finds the stars that exist in both images
 * If the supplied images are color, the specified channel is extracted from the 
 * reference and target images.
 * @param {View} refView Reference view.
 * @param {View} tgtView Target view.
 * @param {Image} starRegionMask Limit star detection to region were pixels = 1)
 * @param {Number} logStarDetectionSensitivity Smaller values detect more stars. -1, to 1 good values
 * @param {Number} upperLimit Ignore stars with a peak value greater than this.
 * @param {Number} channel Detect stars in this RGB channel. B&W = 0, R=0,G=1,B=2
 * @returns {StarPairs}
 */
function getStarPairs(refView, tgtView, starRegionMask, 
        logStarDetectionSensitivity, upperLimit, channel){
            
    const useColorManagement = false;
            
    let isColor = refView.image.isColor;
    let imgRefWindow = null;
    let imgTgtWindow = null;
    let refImage = refView.image;
    let tgtImage = tgtView.image;
    let starRefImage;
    let starTgtImage;
    if (isColor){
        if (useColorManagement){
            // Extract the specified color channel from both target and reference images
            // Slightly more accurate, but slow
            // ChannelExtraction creates a new B&W image for the extracted channel
            let P = new ChannelExtraction;
            P.colorSpace = ChannelExtraction.prototype.RGB;
            P.sampleFormat = ChannelExtraction.prototype.SameAsSource;
            P.channels = [// enabled, id
                [channel % 3 === 0, "REF_CHANNEL"],
                [channel % 3 === 1, "REF_CHANNEL"],
                [channel % 3 === 2, "REF_CHANNEL"]
            ];
            P.executeOn(refView);

            P.channels = [// enabled, id
                [channel % 3 === 0, "TGT_CHANNEL"],
                [channel % 3 === 1, "TGT_CHANNEL"],
                [channel % 3 === 2, "TGT_CHANNEL"]
            ];
            P.executeOn(tgtView);

            imgRefWindow = ImageWindow.windowById( "REF_CHANNEL" );
            imgTgtWindow = ImageWindow.windowById( "TGT_CHANNEL" );
            starRefImage = imgRefWindow.mainView.image;
            starRefImage = imgTgtWindow.mainView.image;
        } else {
            // Dont color manage to increase speed
            // The extra error when the scale is calculated is small:
            // Example: slow method gives 1.100000299505084, this method: 1.1003654077279212

            // Create grey scale 32bit floating point images
            let width = refImage.width;
            let height = refImage.height;
            starRefImage = new Image(width, height, 1);
            starTgtImage = new Image(width, height, 1);
            for (let x = width - 1; x !== 0; x-- ){
                for (let y = height - 1; y !== 0; y--){
                    starTgtImage.setSample(tgtImage.sample(x, y, channel), x, y);
                    starRefImage.setSample(refImage.sample(x, y, channel), x, y);
                }
            }
        }
    } else {
        // Input images are B&W so we can use them directly
        starRefImage = refImage;
        starTgtImage = tgtImage;
    }
    
    // Detect stars in target and reference images
    let tgtStars = detectStars(starTgtImage, starRegionMask, logStarDetectionSensitivity, upperLimit);
    let refStars = detectStars(starRefImage, starRegionMask, logStarDetectionSensitivity, upperLimit);
    let starPairs = findMatchingStars(refStars, tgtStars);

    if (useColorManagement){
        if (isColor){
            // We must close the temporary windows we created
            imgRefWindow.forceClose();
            imgTgtWindow.forceClose();
        }
    }
    
    return starPairs;
}

/**
 * Finds the stars that exist in both images using a search window of 1x1 pixels.
 * @param {Star[]} refStars Stars detected in reference image.
 * @param {Star[]} tgtStars Stars detected in target image.
 * @returns {StarPairs}
 */
function findMatchingStars(refStars, tgtStars){
    let createKey = function(star){
        return "" + Math.round(star.pos.x) + "," + Math.round(star.pos.y);
    };
    
    let starMap = new Map();
    for (let star of refStars){
        starMap.set(createKey(star), star);
    }
    
    // Find stars that are in both images, using a search radius of 1 pixel
    let starPairArray = [];
    for (let tgtStar of tgtStars){
        const key = createKey(tgtStar);
        if (starMap.has(key)){
            starPairArray.push(new StarPair(starMap.get(key), tgtStar));
        }
    }
    return new StarPairs(starPairArray);
}

/**
 * Create bitmap image with overlapping region set to 1
 * @param {Image} refImage
 * @param {Image} tgtImage
 * @param {Rect} previewArea Mask is also limitted by this area
 * @returns {Image} A image mask for the overlapping region
 */
function createStarRegionMask(refImage, tgtImage, previewArea){
    let nChannels = refImage.isColor ? 3 : 1;
    
    let mask = new Image(refImage.width, refImage.height, 1);
    mask.fill(0);
  
    // Create a mask to restrict the star detection to the overlapping area and previewArea
    let xMin = previewArea.x0;
    let xMax = previewArea.x1;
    let yMin = previewArea.y0;
    let yMax = previewArea.y1;
    for (let x = xMin; x < xMax; x++){
        for (let y = yMin; y < yMax; y++){
            let isOverlap = true;
            for (let c = nChannels-1; c >= 0; c--){
                if (tgtImage.sample(x, y, c) === 0 || refImage.sample(x, y, c) === 0){
                    isOverlap = false;
                    break;
                }
            }
            if (isOverlap){
                mask.setSample(1, x, y);
            }
        }
    }
    return mask;
}

/**
 * @param {Image} image Find stars in this image
 * @param {Image} starRegionMask Bitmask used to limit star search region
 * @param {type} logStarDetectionSensitivity
 * @param {type} upperLimit Dont include stars with a peak above this value
 * @returns {Star[]} Detected stars
 */
function detectStars(image, starRegionMask, logStarDetectionSensitivity, upperLimit){
    let starDetector = new StarDetector();
    starDetector.mask = starRegionMask;
    starDetector.sensitivity = Math.pow(10.0, logStarDetectionSensitivity);
    starDetector.upperLimit = upperLimit;
    return starDetector.stars(image);
}

/**
 * Calculates the max and min star flux
 * @returns {StarMinMax}
 */
function StarMinMax() {
    this.maxRefFlux = Number.MIN_VALUE;
    this.maxTgtFlux = Number.MIN_VALUE;
    this.minRefFlux = Number.MAX_VALUE; 
    this.minTgtFlux = Number.MAX_VALUE;

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
    let windowTitle = "Photometry__" + targetName + "__and__" + referenceName;
    let targetLabel = "Target (" + targetName + ")";
    let referenceLabel = "Reference (" + referenceName + ")";
    
    // Create the graph axis and annotation.
    let minMax = new StarMinMax();
    colorStarPairs.forEach(function (starPairs) {
        //minMax.calculateMinMax(starPairs.samplePairArray);
        minMax.calculateMinMax(starPairs.starPairArray);
    });
    let graphWithAxis = new Graph(minMax.minTgtFlux, minMax.minRefFlux, minMax.maxTgtFlux, minMax.maxRefFlux);
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
    let title = view.fullId;
    switch (channel) {
        case 0:
            if (isColor){
                title += "_red_photometry";
            } else {
                title += "_photometry";
            }
            break;
        case 1:
            title += "_green_photometry";
            break;
        case 2:
            title += "_blue_photometry";
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

function displayMask(view, allStars, limitMaskStarsPercent, radiusMult, radiusAdd){
    let title = view.fullId + "_MOSAIC_mask";
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
    G.brush = new Brush();
    for (let i = 0; i < firstNstars; ++i){
        let star = allStars[i];
        let radius = Math.sqrt(star.size)/2;
        G.fillCircle(star.pos, radius * radiusMult + radiusAdd);
    }
    G.end();
    bmp.invert();

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

/**
 * Use star with maximum flux
 */
function CombienStarPairArrays(){
    this.starMap = new Map();
    
    /**
     * @param {StarPair[]} starPairArray
     */
    this.addStarPairArray = function(starPairArray){
        for (let starPair of starPairArray){
            // keep star with maximum flux
            let star = this.brightestStar(starPair.tgtStar, starPair.refStar);
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