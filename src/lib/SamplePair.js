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
 * @param {Rect} selectedArea Area selected by user (e.g. via preview)
 * @returns {SamplePairs}
 */
function SamplePairs(samplePairArray, sampleSize, selectedArea){
    /** SamplePair[] */
    this.samplePairArray = samplePairArray;
    /** Number */
    this.sampleSize = sampleSize;
    /** Rect */
    this.selectedArea = selectedArea;
    /** Rect, Private */
    this.sampleArea = null;                             // Private

    /**
     * @returns {Rect} Bounding rectangle of all samplePair centers
     */
    this.getSampleArea = function(){
        if (this.sampleArea === null) {
            let minX = Number.MAX_VALUE;
            let minY = Number.MAX_VALUE;
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
 * @param {Number} sampleSize
 * @param {Star[]} stars Stars from all channels, target and reference images merged and sorted
 * @param {Number} rejectHigh Ignore samples that contain pixels > rejectHigh
 * @param {Number} limitSampleStarsPercent Percentage of stars to avoid. Lower values ignore more faint stars
 * @param {Rect} selectedArea Reject samples outside this area
 * @returns {SamplePairs[]} Returns SamplePairs for each color
 */
function createColorSamplePairs(targetImage, referenceImage,
        sampleSize, stars, rejectHigh, limitSampleStarsPercent, selectedArea) {

    let firstNstars;
    if (limitSampleStarsPercent < 100){
        firstNstars = Math.floor(stars.length * limitSampleStarsPercent / 100);
    } else {
        firstNstars = stars.length;
    }
                
    // Create colorSamplePairs with empty SamplePairsArrays
    let nChannels = referenceImage.isColor ? 3 : 1;
    let bins = new SampleBinMap(selectedArea, sampleSize, nChannels);
    let xMax = bins.getNumberOfColumns();
    let yMax = bins.getNumberOfRows();
    for (let xKey = 0; xKey < xMax; xKey++){
        for (let yKey = 0; yKey < yMax; yKey++){
            bins.addBinRect(targetImage, referenceImage, xKey, yKey, rejectHigh);
        }
    }
    bins.removeBinRectWithStars(stars, firstNstars);
    // Use the radius of the brightest detected star * 2
    let radius = Math.sqrt(stars[0].size);
    bins.removeBinRectWithSaturatedStars(radius);
    let colorSamplePairs = [];
    for (let c=0; c<nChannels; c++){
        let samplePairArray = bins.createSamplePairArray(targetImage, referenceImage, c);
        colorSamplePairs.push(new SamplePairs(samplePairArray, sampleSize, selectedArea));
    }
    return colorSamplePairs;
}

/**
 * Used to create the SamplePair array.
 * SamplePair[] are used to model the background level and gradient
 * Samples are discarded if they include black pixels or stars
 * @param {Rect} selectedArea Whole image area or selected preview area
 * @param {Number} binSize bin size (SamplePair size)
 * @param {Number} nChannels 1 for B&W, 3 for color
 * @returns {SampleBinMap} 
 */
function SampleBinMap(selectedArea, binSize, nChannels){
    //Sample size
    this.binSize = binSize;
    // Coordinate of top left bin
    this.x0 = selectedArea.x0;
    this.y0 = selectedArea.y0;
    // Coordinate of the first bin that is beyond the selected area
    this.x1 = selectedArea.x1;
    this.y1 = selectedArea.y1;
    // For stars too bright to have been detected by StarDetector
    this.tooBrightMap = new Map();
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
    this.getBinCenter = function(xKey, yKey){
        return new Point(this.getX(xKey) + this.binSize/2, this.getY(yKey) + this.binSize/2);
    };
    /**
     * @returns {Number}
     */
    this.getNumberOfColumns = function(){
        return Math.floor((this.x1 - this.x0) / this.binSize);
    };
    /**
     * 
     * @returns {Number}
     */
    this.getNumberOfRows = function(){
        return Math.floor((this.y1 - this.y0) / this.binSize);
    };
    /**
     * @param {Number} x Any X-Coordinate within a bin, including left edge
     * @returns {Number} Nth sample in x direction (starting at zero)
     */
    this.getXKey = function(x){
        return Math.floor((x - this.x0) / this.binSize);
    };
    /**
     * @param {Number} y Any Y-Coordinate within a bin, including top edge
     * @returns {Number} Nth sample in y direction (starting at zero)
     */
    this.getYKey = function(y){
        return Math.floor((y - this.y0) / this.binSize);
    };
    /**
     * @param {Number} xKey Nth bin in x direction (starting at zero)
     * @returns {Number} X-Coordinate of bin's left edge
     */
    this.getX = function (xKey){
        return this.x0 + xKey * this.binSize;
    };
    /**
     * @param {Number} yKey Nth sample in y direction (starting at zero)
     * @returns {Number} Y-Coordinate of bin's top edge
     */
    this.getY = function (yKey){
        return this.y0 + yKey * this.binSize;
    };
    /**
     * @param {Number} xKey Nth bin in x direction (starting at zero)
     * @param {Number} yKey Nth bin in y direction (starting at zero)
     * @returns {String} Key has format "xKey,yKey" e.g. "3,28"
     */
    this.createKey = function(xKey, yKey){
        return "" + xKey + "," + yKey;
    };
//    this.getKey = function(x, y){
//        let xKey = Math.floor((x - this.x0) / this.binSize);
//        let yKey = Math.floor((y - this.y0) / this.binSize);
//        return this.createKey(xKey, yKey);
//    };
    
    /**
     * If the specified bin does not contain pixels that are zero or > rejectHigh
     * add an entry to our binRect map. If the sample contains a 
     * pixel > rejectHigh save it to a 'too bright' map, with the coordinate of 
     * the brightest pixel. This will probably be a star that was too bright to
     * be picked up by StarDetector.
     * @param {Image} tgtImage
     * @param {Image} refImage
     * @param {Number} xKey Nth sample in x direction (starting at zero)
     * @param {Number} yKey Nth sample in y direction (starting at zero)
     * @param {Number} rejectHigh Reject samples with pixels greater than this
     */
    this.addBinRect = function(tgtImage, refImage, xKey, yKey, rejectHigh){
        let nChannels = this.binRectMapArray.length;
        let binRect = new Rect(this.binSize, this.binSize);
        binRect.moveTo(this.getX(xKey), this.getY(yKey));
        for (let c=0; c < nChannels; c++){
            // Dont add sample if it contains 1 or more pixels that are black
            if (tgtImage.minimum(binRect, c, c) === 0 || refImage.minimum(binRect, c, c) === 0){
                // exclude this sample from this channel.
                continue;
            }
            if (tgtImage.maximum(binRect) > rejectHigh || refImage.maximum(binRect) > rejectHigh){
                // Star will not be in star array, so deal with it seperately
                this.tooBrightMap.set(this.createKey(xKey, yKey), refImage.maximumPosition(binRect));
                return;
            }
            this.binRectMapArray[c].set(this.createKey(xKey, yKey), binRect);
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
            this.removeBinsInCircle(star.pos, starRadius);
        }
    };
    
    /**
     * Remove all bin entries that are fully or partially covered by a saturated star
     * addBinRect() records these to the 'tooBrightMap', along with the
     * position of the brightest pixel. We treat this brightest pixel as the 
     * center of a bright star.
     * @param {Number} starRadius
     */
    this.removeBinRectWithSaturatedStars = function(starRadius){
        for (let point of this.tooBrightMap.values()){
            this.removeBinsInCircle(point, starRadius);
        }
    };
    
    /**
     * Reject bin entries from the map if:
     * DISTANCE > (starRadius + binSize/2)
     * where DISTANCE = (center of star) to (center of bin)
     * @param {Point} p
     * @param {Number} starRadius
     */
    this.removeBinsInCircle = function (p, starRadius) {
        let starToCenter = starRadius + binSize/2;
        let starXKey = this.getXKey(p.x);
        let starYKey = this.getYKey(p.y);
        let minXKey = this.getXKey(p.x - starRadius);
        let maxXKey = this.getXKey(p.x + starRadius);
        let minYKey = this.getYKey(p.y - starRadius);
        let maxYKey = this.getYKey(p.y + starRadius);
        for (let xKey = minXKey; xKey <= maxXKey; xKey++) {
            for (let yKey = minYKey; yKey <= maxYKey; yKey++) {
                if (xKey === starXKey || yKey === starYKey) {
                    this.removeBinRect(xKey, yKey);
                } else {
                    let binCenter = this.getBinCenter(xKey, yKey);
                    if (p.distanceTo(binCenter) < starToCenter) {
                        this.removeBinRect(xKey, yKey);
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
    this.removeBinRect = function(xKey, yKey){
        let key = this.createKey(xKey, yKey);
        for (let c=0; c < this.binRectMapArray.length; c++){
            this.binRectMapArray[c].delete(key);
        }
    };
    
    /**
     * Calculates SamplePair[] for specified channel
     * Calculates median of each bin for both target and reference images,
     * creates a SamplePair and adds it to the SamplePair[] array
     * @param {Image} tgtImage
     * @param {Image} refImage
     * @param {Number} channel 0 for B&W, 0,1,2 for RGB
     * @returns {Array|SampleBinMap.createSamplePairArray.samplePairArray}
     */
    this.createSamplePairArray = function(tgtImage, refImage, channel){
        let samplePairArray = [];
        for (let binRect of this.binRectMapArray[channel].values()) {
            let tgtMedian = tgtImage.median(binRect, channel, channel);
            let refMedian = refImage.median(binRect, channel, channel);
            samplePairArray.push(new SamplePair(tgtMedian, refMedian, binRect));
        }
        return samplePairArray;
    };
}

/** Display the SamplePair by drawing them into a mask image
 * @param {Image} view Determine bitmap size from this view's image.
 * @param {SamplePairs} samplePairs The samplePairs to be displayed.
 * @param {Star[]} stars 
 * @param {Number} limitSampleStarsPercent Percentage of stars to avoid. Lower values ignore more faint stars 
 * @param {String} title Window title
 */
function displaySampleSquares(view, samplePairs, 
        stars, limitSampleStarsPercent, title) {
    let image = view.image;
    let bmp = new Bitmap(image.width, image.height);
    bmp.fill(0xffffffff);
    let G = new VectorGraphics(bmp);
    //let G = new Graphics(bmp);  // good for debug
    G.pen = new Pen(0xff000000);
    samplePairs.samplePairArray.forEach(function (samplePair) {
        G.drawRect(samplePair.rect);
    });

    let firstNstars;
    if (limitSampleStarsPercent < 100){
        firstNstars = Math.floor(stars.length * limitSampleStarsPercent / 100);
    } else {
        firstNstars = stars.length;
    }
    G.antialiasing = true;
    for (let i = 0; i < firstNstars; ++i){
        let star = stars[i];
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
