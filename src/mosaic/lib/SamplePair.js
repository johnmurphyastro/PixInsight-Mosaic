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
    this.weight = 1;
}

/**
 * Contains SamplePair[]
 * @param {SamplePair[]} samplePairArray
 * @param {Rect} overlapBox overlap bounding box
 * @returns {SamplePairs}
 */
function SamplePairs(samplePairArray, overlapBox){
    /** SamplePair[] */
    this.samplePairArray = samplePairArray;
    /** Rect */
    this.overlapBox = overlapBox;
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
 * @param {Boolean} isHorizontal Determines sort order for SamplePair
 * @returns {SamplePairs[]} Returns SamplePairs for each color
 */
function createColorSamplePairs(targetImage, referenceImage, scaleFactors,
        stars, sampleRect, data, isHorizontal) {

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
        let samplePairArray = bins.createSamplePairArray(targetImage, referenceImage,
                scale, c, isHorizontal);
        colorSamplePairs.push(new SamplePairs(samplePairArray, sampleRect));
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
    function getBinCenter(xKey, yKey){
        return new Point(getX(xKey) + self.binSize/2, getY(yKey) + self.binSize/2);
    };
    /**
     * @returns {Number}
     */
    function getNumberOfColumns(){
        return Math.floor((self.x1 - self.x0) / self.binSize);
    };
    /**
     * 
     * @returns {Number}
     */
    function getNumberOfRows(){
        return Math.floor((self.y1 - self.y0) / self.binSize);
    };
    /**
     * @param {Number} x Any X-Coordinate within a bin, including left edge
     * @returns {Number} Nth sample in x direction (starting at zero)
     */
    function getXKey(x){
        return Math.floor((x - self.x0) / self.binSize);
    };
    /**
     * @param {Number} y Any Y-Coordinate within a bin, including top edge
     * @returns {Number} Nth sample in y direction (starting at zero)
     */
    function getYKey(y){
        return Math.floor((y - self.y0) / self.binSize);
    };
    /**
     * @param {Number} xKey Nth bin in x direction (starting at zero)
     * @returns {Number} X-Coordinate of bin's left edge
     */
    function getX(xKey){
        return self.x0 + xKey * self.binSize;
    };
    /**
     * @param {Number} yKey Nth sample in y direction (starting at zero)
     * @returns {Number} Y-Coordinate of bin's top edge
     */
    function getY(yKey){
        return self.y0 + yKey * self.binSize;
    };
    /**
     * @param {Number} xKey Nth bin in x direction (starting at zero)
     * @param {Number} yKey Nth bin in y direction (starting at zero)
     * @returns {String} Key has format "xKey,yKey" e.g. "3,28"
     */
    function createKey(xKey, yKey){
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
    function addBinRect(tgtImage, refImage, xKey, yKey, rejectHigh){
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
    function removeBinsInCircle(p, starRadius) {
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
    function removeBinRect(xKey, yKey){
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
     * @param {Boolean} isHorizontal Determines sort order
     * @returns {SamplePair[]} SamplePair array, sorted by distance along join
     */
    this.createSamplePairArray = function(tgtImage, refImage, scale, channel, isHorizontal){
        let samplePairArray = [];
        for (let binRect of this.binRectMapArray[channel].values()) {
            let tgtMedian = tgtImage.median(binRect, channel, channel) * scale;
            let refMedian = refImage.median(binRect, channel, channel);
            samplePairArray.push(new SamplePair(tgtMedian, refMedian, binRect));
        }
        // Sort by distance along join
        if (isHorizontal){
            samplePairArray.sort((a, b) => a.rect.x0 - b.rect.x0);
        } else {
            samplePairArray.sort((a, b) => a.rect.y0 - b.rect.y0);
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
    let offsetX = -overlapBox.x0;
    let offsetY = -overlapBox.y0;
    let bmp = new Bitmap(overlapBox.width, overlapBox.height);
    bmp.fill(0x00000000);
    //let G = new VectorGraphics(bmp);
    let G = new Graphics(bmp);  // makes it easier to see which samples have been rejected
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
    fitsHeaderImages(keywords, data);
    fitsHeaderStarDetection(keywords, data);
    fitsHeaderGradient(keywords, data, false, false);
    
    createOverlapImage(refView, data.cache.overlap, bmp, title, keywords, 1);
}

/**
 * Get the width of the grid of unrejected samples in terms of sample width.
 * Used for a vertical join (long columns, short rows).
 * @param {Rect} sampleRect
 * @param {SamplePair[]} samplePairArray
 * @returns {Number}
 */
function getSampleGridWidth(sampleRect, samplePairArray){
    if (samplePairArray.length === 0){
        return 0;
    }
    let sampleWidth = samplePairArray[0].rect.width;
    let maxX = samplePairArray[0].rect.x0;
    let minX = maxX;
    let nRows = 0;
    let maximumPossible = Math.floor(sampleRect.width / sampleWidth);
    for (let samplePair of samplePairArray){
        maxX = Math.max(maxX, samplePair.rect.x0);
        minX = Math.min(minX, samplePair.rect.x0);
        nRows = Math.floor((maxX - minX) / sampleWidth) + 1;
        if (nRows >= maximumPossible){
            break;
        }
    }
    return nRows;
}

/**
 * Get the height of the grid of unrejected samples in terms of columns.
 * Used for a horizontal join (short columns, long rows).
 * @param {Rect} sampleRect
 * @param {SamplePair[]} samplePairArray
 * @returns {Number}
 */
function getSampleGridHeight(sampleRect, samplePairArray){
    if (samplePairArray.length === 0){
        return 0;
    }
    let sampleHeight = samplePairArray[0].rect.height;
    let maxY = samplePairArray[0].rect.y0;
    let minY = maxY;
    let nCols = 0;
    let maximumPossible = Math.floor(sampleRect.height / sampleHeight);
    for (let samplePair of samplePairArray){
        maxY = Math.max(maxY, samplePair.rect.y0);
        minY = Math.min(minY, samplePair.rect.y0);
        nCols = Math.floor((maxY - minY) / sampleHeight) + 1;
        if (nCols >= maximumPossible){
            break;
        }
    }
    return nCols;
}

/**
 * Determine x and y binning factor that will reduce the number of samples to
 * less than maxLength, assuming no samples were rejected (e.g. due to stars).
 * The shape of the binning (e.g. 2x2 or 4x1) is determined by how thick the join is.
 * @param {Rect} sampleRect
 * @param {SamplePair[]} samplePairArray
 * @param {Number} maxLength Maximum number of samples after binning
 * @param {Number} minRowsOrColumns Minimum thickness of sample grid after binning
 * @param {Boolean} isHorizontal
 * @returns {Point} Stores the x and y binning factors
 */
function calcBinningFactor(sampleRect, samplePairArray, maxLength, minRowsOrColumns, isHorizontal){
    let joinBinning;
    let perpBinning;
    let gridThickness = 0;
    if (isHorizontal){
        gridThickness = getSampleGridHeight(sampleRect, samplePairArray);
    } else {
        gridThickness = getSampleGridWidth(sampleRect, samplePairArray);
    }

    // what reduction factor is required? 2, 4, 9 or 16?
    let factor = samplePairArray.length / maxLength;
    if (factor > 16){
        let bining = Math.ceil(Math.sqrt(factor));
        joinBinning = bining;
        perpBinning = bining;
    } else if (factor > 9){
        // Reduce number of samples by a factor of 16
        if (gridThickness >= minRowsOrColumns * 4){
            // 4x4 binning
            joinBinning = 4;
            perpBinning = 4;
        } else if (gridThickness >= minRowsOrColumns * 3){
            // 5x3 binning
            joinBinning = 5;
            perpBinning = 3;
        } else if (gridThickness >= minRowsOrColumns * 2){
            // 8x2 binning
            joinBinning = 8;
            perpBinning = 2;
        } else {
            // 8x1 binning
            joinBinning = 16;
            perpBinning = 1;
        }
    } else if (factor > 4){
        // Reduce number of samples by a factor of 8 or 9
        if (gridThickness >= minRowsOrColumns * 3){
            // 3x3 binning
            joinBinning = 3;
            perpBinning = 3;
        } else if (gridThickness >= minRowsOrColumns * 2){
            // 4x2 binning
            joinBinning = 4;
            perpBinning = 2;
        } else {
            // 8x1 binning
            joinBinning = 8;
            perpBinning = 1;
        }
    } else if (factor > 2){
        // Reduce by factor of 4
        if (gridThickness >= minRowsOrColumns * 2){
            joinBinning = 2;
            perpBinning = 2;
        } else {
            joinBinning = 4;
            perpBinning = 1;
        }
    } else {
        // Reduce by factor of 2
        if (gridThickness >= minRowsOrColumns * 2){
            joinBinning = 1;
            perpBinning = 2;
        } else {
            joinBinning = 2;
            perpBinning = 1;
        }
    }

    if (isHorizontal){
        return new Point(joinBinning, perpBinning);
    }
    return new Point(perpBinning, joinBinning);
}

/**
 * Create a single SamplePair from the supplied array of SamplePair.
 * The input SamplePair[] must all be the same shape and size and have weight=1
 * @param {SamplePair[]} insideBin SamplePairs that are inside the bin area
 * @param {Number} sampleWidth Width of a single input SamplePair
 * @param {Number} sampleHeight Height of a single input SamplePair
 * @param {Number} binWidth Width of fully populated bin in pixels
 * @param {Number} binHeight height of fully populated bin in pixels
 * @returns {SamplePair} Binned SamplePair with center based on center of mass
 */
function createBinnedSamplePair(insideBin, sampleWidth, sampleHeight, binWidth, binHeight){
    // Weight is the number of input SamplePair that are in the binned area.
    // Not always the geometricaly expected number due to SamplePair rejection (e.g. stars)
    const weight = insideBin.length;
    
    // binnedSamplePair center: calculated from center of mass
    // CoM = (m1.x1 + m2.x2 + m3.x3 + ...) / (m1 + m2 + m3 + ...)
    // But in our case all input samples have weight = 1
    // So CoM = (x1 + x2 + x3 + ...) / nSamples
    let xCm = 0;
    let yCm = 0;
    let targetMedian = 0;
    let referenceMedian = 0;
    for (let sp of insideBin){
        xCm += sp.rect.center.x;
        yCm += sp.rect.center.y;
        targetMedian += sp.targetMedian;
        referenceMedian += sp.referenceMedian;
    }
    let center = new Point(Math.round(xCm/weight), Math.round(yCm/weight));
    
    // Use the average value for target and reference median
    targetMedian /= weight;
    referenceMedian /= weight;
    
    
    // Area is (weight) * (area of a single input SamplePair)
    // Create a square binnedSamplePair based on this area and the calculated center
    let area = weight * sampleWidth * sampleHeight;
    let halfWidth;
    let halfHeight;
    if (area === binWidth * binHeight){
        // fully populated bin
        halfWidth = Math.round(binWidth / 2);
        halfHeight = Math.round(binHeight / 2);
    } else {
        halfWidth = Math.round(Math.sqrt(area)/2);
        halfHeight = halfWidth;
    }
    let x0 = center.x - halfWidth;
    let x1 = center.x + halfWidth;
    let y0 = center.y - halfHeight;
    let y1 = center.y + halfHeight;
    let rect = new Rect(x0, y0, x1, y1);
    let binnedSamplePair = new SamplePair(targetMedian, referenceMedian, rect);
    binnedSamplePair.weight = weight;
    return binnedSamplePair;
}

/**
 * Create a binned SamplePair array of larger samples to reduce the number of
 * samples to less then sampleMaxLimit. It assumes no samples were rejected by stars,
 * so the binned SamplePair array may exceed sampleMaxLimit due to star rejection.
 * @param {Rect} sampleRect
 * @param {SamplePair[]} samplePairArray Must all be the same shape and size and have weight=1
 * @param {Number} sampleMaxLimit Try to reduce the number of samples to below this number 
 * @param {Number} minRows Limit binning perpendicular to join if the final join thickness is less than this.
 * @param {Boolean} isHorizontal
 * @returns {SamplePair[]} Binned SamplePair with center based on center of mass
 */
function createBinnedSamplePairArray(sampleRect, samplePairArray, sampleMaxLimit, minRows, isHorizontal){
    let factor = calcBinningFactor(sampleRect, samplePairArray, sampleMaxLimit, minRows, isHorizontal);

    // width and height of single input sample
    let sampleWidth = samplePairArray[0].rect.width;
    let sampleHeight = samplePairArray[0].rect.height;

    let binWidth = sampleWidth * factor.x;
    let binHeight = sampleHeight * factor.y;
    
    // Create an empty 3 dimensional array
    // The x,y dimensions specify the new binned sample positions
    // Each (x,y) location stores all the input samples within this binned area
    let xLen = Math.floor(sampleRect.width / binWidth) + 1;
    let yLen = Math.floor(sampleRect.height / binHeight) + 1;
    let binnedSampleArrayXY = new Array(xLen);
    for (let x=0; x<xLen; x++){
        binnedSampleArrayXY[x] = new Array(yLen);
        for (let y=0; y<yLen; y++){
            binnedSampleArrayXY[x][y] = [];
        }
    }

    // Populate the (x,y) locations with the input samples that fall into each (x,y) bin
    for (let samplePair of samplePairArray){
        let x = Math.floor((samplePair.rect.center.x - sampleRect.x0) / binWidth);
        let y = Math.floor((samplePair.rect.center.y - sampleRect.y0) / binHeight);
        binnedSampleArrayXY[x][y].push(samplePair);
    }

    // For each (x,y) location that stores one or more input samples,
    // create a binned sample and add it to the binnedSampleArray
    let binnedSampleArray = [];
    for (let x=0; x<xLen; x++){
        for (let y=0; y<yLen; y++){
            if (binnedSampleArrayXY[x][y].length > 0){
                binnedSampleArray.push(createBinnedSamplePair(binnedSampleArrayXY[x][y],
                        sampleWidth, sampleHeight, binWidth, binHeight));
            }
        }
    }
    return binnedSampleArray;
}

/**
 * For performance, if there are more than sampleMaxLimit samples, the samples are binned
 * into super samples. The binning in x and y directions may differ to ensure that
 * the 'thickness' of the join is not reduced to less than 5 samples by the binning.
 * @param {Rect} overlapBox
 * @param {SamplePairs} samplePairs
 * @param {Boolean} isHorizontal
 * @param {Number} sampleMaxLimit
 * @returns {SamplePairs}
 */
function limitNumberOfSamples(overlapBox, samplePairs, isHorizontal, sampleMaxLimit){
    const minRows = 5;
    let samplePairArray = samplePairs.samplePairArray;
    if (samplePairArray.length > sampleMaxLimit){
        let binnedSampleArray = createBinnedSamplePairArray(overlapBox, samplePairArray, 
                sampleMaxLimit, minRows, isHorizontal);
        if (binnedSampleArray.length > sampleMaxLimit){
            // This can happen because many samples in grid were rejected due to stars
            sampleMaxLimit *= sampleMaxLimit / binnedSampleArray.length;
            binnedSampleArray = createBinnedSamplePairArray(overlapBox, samplePairArray, 
                sampleMaxLimit, minRows, isHorizontal);
        }
        return new SamplePairs(binnedSampleArray, samplePairs.overlapBox);
    }
    return samplePairs;
}