/* global UndoFlag_NoSwapFile */

// Version 1.0 (c) John Murphy 20th-Feb-2020
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

/**
 * 
 * @param {Number} targetMedian
 * @param {Number} referenceMedian
 * @param {Rect} rect Bounding box of sample
 * @returns {SamplePair}
 */
function SamplePair(targetMedian, referenceMedian, rect) {
    this.targetMedian = targetMedian;
    this.referenceMedian = referenceMedian;
    this.rect = rect;
}

/**
 * Contains SamplePair[]
 * @param {SamplePair[]} samplePairArray
 * @param {Number} sampleSize
 * @param {Rect} overlapBox overlap bounding box
 * @returns {SamplePairs}
 */
function SamplePairs(samplePairArray, sampleSize, overlapBox){
    /** SamplePair[] */
    this.samplePairArray = samplePairArray;
    /** Number */
    this.sampleSize = sampleSize;
    /** Rect */
    this.overlapBox = overlapBox;
    /** Rect, Private */
    this.sampleArea = null;                             // Private

    /**
     * @returns {Rect} Bounding rectangle of all samplePair centers
     */
    this.getSampleArea = function(){
        if (this.sampleArea === null) {
            let minX = Number.POSITIVE_INFINITY;
            let minY = Number.POSITIVE_INFINITY;
            let maxX = 0;
            let maxY = 0;
            for (let samplePair of samplePairArray) {
                let centerX = samplePair.rect.center.x;
                let centerY = samplePair.rect.center.y;
                minX = Math.min(minX, centerX);
                maxX = Math.max(maxX, centerX);
                minY = Math.min(minY, centerY);
                maxY = Math.max(maxY, centerY);
            }
            this.sampleArea = new Rect(minX, minY, maxX, maxY);
        }
        return this.sampleArea;
    };
}

// ============ Algorithms ============
/**
 * Create SamplePairs for each color channel
 * @param {Image} targetImage
 * @param {Image} referenceImage
 * @param {LinearFitData[]} scaleFactors
 * @param {Star[]} stars Stars from all channels, target and reference images merged and sorted
 * @param {Rect} sampleRect Reject samples outside this area (overlap bounding box)
 * @param {PhotometricMosaicData} data User settings
 * @returns {SamplePairs[]} Returns SamplePairs for each color
 */
function createColorSamplePairs(targetImage, referenceImage, scaleFactors,
        stars, sampleRect, data) {

    let firstNstars;
    if (data.limitSampleStarsPercent < 100){
        firstNstars = Math.floor(stars.length * data.limitSampleStarsPercent / 100);
    } else {
        firstNstars = stars.length;
    }
                
    // Create colorSamplePairs with empty SamplePairsArrays
    let nChannels = referenceImage.isColor ? 3 : 1;
    let bins = new SampleBinMap(sampleRect, data.sampleSize, nChannels);
    bins.addSampleBins(targetImage, referenceImage, data.linearRange);
    bins.removeBinRectWithStars(stars, firstNstars);
    
    // Use the radius of the brightest detected star * 2
    //let radius = Math.sqrt(stars[0].size);
    //bins.removeBinRectWithSaturatedStars(radius);
    let colorSamplePairs = [];
    for (let c=0; c<nChannels; c++){
        let scale = scaleFactors[c].m;
        let samplePairArray = bins.createSamplePairArray(targetImage, referenceImage, scale, c);
        colorSamplePairs.push(new SamplePairs(samplePairArray, data.sampleSize, sampleRect));
    }
    return colorSamplePairs;
}

/**
 * Used to create the SamplePair array.
 * SamplePair[] are used to model the background level and gradient
 * Samples are discarded if they include black pixels or stars
 * @param {Rect} overlapBox overlap bounding box
 * @param {Number} binSize bin size (SamplePair size)
 * @param {Number} nChannels 1 for B&W, 3 for color
 * @returns {SampleBinMap} 
 */
function SampleBinMap(overlapBox, binSize, nChannels){
    const self = this;
    //Sample size
    this.binSize = binSize;
    // Coordinate of top left bin
    this.x0 = overlapBox.x0;
    this.y0 = overlapBox.y0;
    // Coordinate of the first bin that is beyond the selected area
    this.x1 = overlapBox.x1;
    this.y1 = overlapBox.y1;
    // For stars too bright to have been detected by StarDetector
//    this.tooBrightMap = new Map();

    // binRect maps for all colors
    this.binRectMapArray = [];
    for (let c=0; c<nChannels; c++){
        this.binRectMapArray.push(new Map());
    }
    
    /**
     * @param {Number} xKey Nth bin in x direction (starting at zero)
     * @param {Number} yKey Nth bin in y direction (starting at zero)
     * @returns {Point} The (x,y) coordinate of the bin's center
     */
    let getBinCenter = function(xKey, yKey){
        return new Point(getX(xKey) + self.binSize/2, getY(yKey) + self.binSize/2);
    };
    /**
     * @returns {Number}
     */
    let getNumberOfColumns = function(){
        return Math.floor((self.x1 - self.x0) / self.binSize);
    };
    /**
     * 
     * @returns {Number}
     */
    let getNumberOfRows = function(){
        return Math.floor((self.y1 - self.y0) / self.binSize);
    };
    /**
     * @param {Number} x Any X-Coordinate within a bin, including left edge
     * @returns {Number} Nth sample in x direction (starting at zero)
     */
    let getXKey = function(x){
        return Math.floor((x - self.x0) / self.binSize);
    };
    /**
     * @param {Number} y Any Y-Coordinate within a bin, including top edge
     * @returns {Number} Nth sample in y direction (starting at zero)
     */
    let getYKey = function(y){
        return Math.floor((y - self.y0) / self.binSize);
    };
    /**
     * @param {Number} xKey Nth bin in x direction (starting at zero)
     * @returns {Number} X-Coordinate of bin's left edge
     */
    let getX = function (xKey){
        return self.x0 + xKey * self.binSize;
    };
    /**
     * @param {Number} yKey Nth sample in y direction (starting at zero)
     * @returns {Number} Y-Coordinate of bin's top edge
     */
    let getY = function (yKey){
        return self.y0 + yKey * self.binSize;
    };
    /**
     * @param {Number} xKey Nth bin in x direction (starting at zero)
     * @param {Number} yKey Nth bin in y direction (starting at zero)
     * @returns {String} Key has format "xKey,yKey" e.g. "3,28"
     */
    let createKey = function(xKey, yKey){
        return "" + xKey + "," + yKey;
    };
    
    /**
     * Add all bins within the selected area.
     * Reject bins with one or more zero pixels.
     * @param {Image} targetImage
     * @param {Image} referenceImage
     * @param {Number} rejectHigh TODO Not currently used
     * @returns {undefined}
     */
    this.addSampleBins = function(targetImage, referenceImage, rejectHigh){
        let xMax = getNumberOfColumns();
        let yMax = getNumberOfRows();
        for (let xKey = 0; xKey < xMax; xKey++){
            for (let yKey = 0; yKey < yMax; yKey++){
                addBinRect(targetImage, referenceImage, xKey, yKey, rejectHigh);
            }
        }
    };
    
    /** TODO rejectHigh not currently used
     * If the specified bin does not contain pixels that are zero or > rejectHigh
     * add an entry to our binRect map. If the sample contains a 
     * pixel > rejectHigh save it to a 'too bright' map, with the coordinate of 
     * the brightest pixel. This will probably be a star that was too bright to
     * be picked up by StarDetector.
     * @param {Image} tgtImage
     * @param {Image} refImage
     * @param {Number} xKey Nth sample in x direction (starting at zero)
     * @param {Number} yKey Nth sample in y direction (starting at zero)
     * @param {Number} rejectHigh Reject samples with pixels greater than this TODO
     */
    let addBinRect = function(tgtImage, refImage, xKey, yKey, rejectHigh){
        let nChannels = self.binRectMapArray.length;
        let binRect = new Rect(self.binSize, self.binSize);
        binRect.moveTo(getX(xKey), getY(yKey));
        for (let c=0; c < nChannels; c++){
            // Dont add sample if it contains 1 or more pixels that are black
            if (tgtImage.minimum(binRect, c, c) === 0 || refImage.minimum(binRect, c, c) === 0){
                // exclude this sample from this channel.
                continue;
            }
//            if (tgtImage.maximum(binRect) > rejectHigh || refImage.maximum(binRect) > rejectHigh){
//                // Star will not be in star array, so deal with it seperately
//                this.tooBrightMap.set(this.createKey(xKey, yKey), refImage.maximumPosition(binRect));
//                return;
//            }
            self.binRectMapArray[c].set(createKey(xKey, yKey), binRect);
        }
    };
    
    /**
     * Remove all bin entries that are fully or partially covered by a star
     * @param {Star[]} stars Must be sorted by flux before calling this function
     * @param {Number} firstNstars Only use this number of the brightest stars
     */
    this.removeBinRectWithStars = function(stars, firstNstars){
        for (let i=0; i<firstNstars; i++){
            let star = stars[i];
            // This will allow the star to clip the box corner, but that will
            // not significantly affect the bin's median value
            let starRadius = Math.sqrt(star.size)/2;
            removeBinsInCircle(star.pos, starRadius);
        }
    };
    
//    /**
//     * Remove all bin entries that are fully or partially covered by a saturated star
//     * addBinRect() records these to the 'tooBrightMap', along with the
//     * position of the brightest pixel. We treat this brightest pixel as the 
//     * center of a bright star.
//     * @param {Number} starRadius
//     */
//    this.removeBinRectWithSaturatedStars = function(starRadius){
//        for (let point of this.tooBrightMap.values()){
//            this.removeBinsInCircle(point, starRadius);
//        }
//    };
    
    /**
     * Reject bin entries from the map if:
     * DISTANCE > (starRadius + binSize/2)
     * where DISTANCE = (center of star) to (center of bin)
     * @param {Point} p
     * @param {Number} starRadius
     */
    let removeBinsInCircle = function (p, starRadius) {
        let starToCenter = starRadius + binSize/2;
        let starXKey = getXKey(p.x);
        let starYKey = getYKey(p.y);
        let minXKey = getXKey(p.x - starRadius);
        let maxXKey = getXKey(p.x + starRadius);
        let minYKey = getYKey(p.y - starRadius);
        let maxYKey = getYKey(p.y + starRadius);
        for (let xKey = minXKey; xKey <= maxXKey; xKey++) {
            for (let yKey = minYKey; yKey <= maxYKey; yKey++) {
                if (xKey === starXKey || yKey === starYKey) {
                    removeBinRect(xKey, yKey);
                } else {
                    let binCenter = getBinCenter(xKey, yKey);
                    if (p.distanceTo(binCenter) < starToCenter) {
                        removeBinRect(xKey, yKey);
                    }
                }
            }
        }
    };
    
    /**
     * Remove specified binRect from the map
     * @param {Number} xKey Nth sample in x direction (starting at zero)
     * @param {Number} yKey Nth sample in y direction (starting at zero)
     */
    let removeBinRect = function(xKey, yKey){
        let key = createKey(xKey, yKey);
        for (let c=0; c < self.binRectMapArray.length; c++){
            self.binRectMapArray[c].delete(key);
        }
    };
    
    /**
     * Calculates SamplePair[] for specified channel.
     * Calculates median of each bin for both target and reference images,
     * creates a SamplePair and adds it to the SamplePair[] array
     * @param {Image} tgtImage
     * @param {Image} refImage
     * @param {Number} scale Scale factor for target image samples
     * @param {Number} channel 0 for B&W, 0,1,2 for RGB
     * @returns {Array|SampleBinMap.createSamplePairArray.samplePairArray}
     */
    this.createSamplePairArray = function(tgtImage, refImage, scale, channel){
        let samplePairArray = [];
        for (let binRect of this.binRectMapArray[channel].values()) {
            let tgtMedian = tgtImage.median(binRect, channel, channel) * scale;
            let refMedian = refImage.median(binRect, channel, channel);
            samplePairArray.push(new SamplePair(tgtMedian, refMedian, binRect));
        }
        return samplePairArray;
    };
}

/** Display the SamplePair squares
 * @param {Image} refView Copy image and STF from this view.
 * @param {SamplePairs} samplePairs The samplePairs to be displayed.
 * @param {StarsDetected} detectedStars
 * @param {String} title Window title
 * @param {PhotometricMosaicData} data User settings
 */
function displaySampleSquares(refView, samplePairs, detectedStars, title, data) {
    const overlapBox = data.cache.overlap.overlapBox;
    const overlapMask = data.cache.overlap.overlapMask;
    let offsetX = -overlapBox.x0;
    let offsetY = -overlapBox.y0;
    let bmp = new Bitmap(overlapBox.width, overlapBox.height);
    bmp.fill(0x00000000);
    let G = new VectorGraphics(bmp);
    //let G = new Graphics(bmp);  // good for debug
    G.pen = new Pen(0xffff0000);
    samplePairs.samplePairArray.forEach(function (samplePair) {
        let rect = new Rect(samplePair.rect);
        rect.translateBy(offsetX, offsetY);
        G.drawRect(rect);
    });

    let stars = detectedStars.allStars;
    let firstNstars;
    if (data.limitSampleStarsPercent < 100){
        firstNstars = Math.floor(stars.length * data.limitSampleStarsPercent / 100);
    } else {
        firstNstars = stars.length;
    }
    G.antialiasing = true;
    for (let i = 0; i < firstNstars; ++i){
        let star = stars[i];
        let radius = Math.sqrt(star.size)/2;
        let x = star.pos.x + offsetX;
        let y = star.pos.y + offsetY;
        G.strokeCircle(x, y, radius);
    }
    G.end();
    
    let keywords = [];
    keywords.push(new FITSKeyword("COMMENT", "", "Ref: " + refView.fullId));
    keywords.push(new FITSKeyword("COMMENT", "", "Tgt: " + data.targetView.fullId));
    keywords.push(new FITSKeyword("COMMENT", "", "Star Detection: " + data.logStarDetection));
    keywords.push(new FITSKeyword("COMMENT", "", "Sample Size: " + data.sampleSize));
    keywords.push(new FITSKeyword("COMMENT", "", "Limit Stars Percent: " + data.limitSampleStarsPercent));
    
    createDiagnosticImage(refView, overlapBox, overlapMask, bmp, title, keywords, -2);
}
