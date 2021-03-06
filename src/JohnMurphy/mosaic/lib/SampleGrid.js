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
    /**
     * @returns {Number} targetMedian - referenceMedian
     */
    this.getDifference = function(){
        return this.targetMedian - this.referenceMedian;
    };
}

// ============ Algorithms ============
/**
 * Create SamplePair[] for each color channel
 * @param {Star[]} stars Stars from all channels, target and reference images merged and sorted
 * @param {PhotometricMosaicData} data User settings
 * @param {Number} growthRate data.sampleStarGrowthRate or data.sampleStarGrowthRateTarget
 * @param {Number} growthLimit data.sampleStarGrowthLimit or data.sampleStarGrowthLimitTarget
 * @returns {SampleGridMap} Map of sample squares (all color channels)
 */
function createSampleGridMap(stars, data, growthRate, growthLimit) {
    let targetImage = data.targetView.image;
    let referenceImage = data.referenceView.image;
    let sampleRect = data.cache.overlap.overlapBox;
    let firstNstars;
    if (data.limitSampleStarsPercent < 100){
        firstNstars = Math.floor(stars.length * data.limitSampleStarsPercent / 100);
    } else {
        firstNstars = stars.length;
    }
                
    // Create colorSamplePairs with empty SamplePairsArrays
    let nChannels = referenceImage.isColor ? 3 : 1;
    let sampleGridMap = new SampleGridMap(sampleRect, data.sampleSize, nChannels);
    sampleGridMap.addSampleBins(targetImage, referenceImage);
    sampleGridMap.removeBinRectWithStars(stars, data, firstNstars, growthRate, growthLimit);
    
    return sampleGridMap;
}

/**
 * Create SamplePair[] for each color channel
 * @param {SampleGridMap} sampleGridMap Map of sample squares (all color channels)
 * @param {Image} targetImage
 * @param {Image} referenceImage
 * @param {LinearFitData[]} scaleFactors
 * @param {Boolean} isHorizontal Determines sort order for SamplePair
 * @returns {SamplePair[][]} Returns SamplePair[] for each color
 */
function createSamplePairs(sampleGridMap, targetImage, referenceImage, scaleFactors, isHorizontal){
    let nChannels = referenceImage.isColor ? 3 : 1;
    let colorSamplePairs = [];
    for (let c=0; c<nChannels; c++){
        let scale = scaleFactors[c].m;
        let samplePairArray = sampleGridMap.createSamplePairArray(targetImage, referenceImage,
                scale, c, isHorizontal);
        colorSamplePairs.push(samplePairArray);
    }
    return colorSamplePairs;
}

/**
 * Used to create the SamplePair array.
 * SamplePair[] are used to model the background level and gradient
 * Samples are discarded if they include black pixels or stars
 * @param {Rect} overlapBox overlap bounding box
 * @param {Number} sampleSize Bin size (SamplePair size)
 * @param {Number} nChannels 1 for B&W, 3 for color
 * @returns {SampleGridMap} 
 */
function SampleGridMap(overlapBox, sampleSize, nChannels){
    // Private class variables

    //Sample size
    let binSize_ = sampleSize;
    // Coordinate of top left bin
    let x0_ = overlapBox.x0;
    let y0_ = overlapBox.y0;
    // Coordinate of the first bin that is beyond the selected area
    let x1_ = overlapBox.x1;
    let y1_ = overlapBox.y1;
    // binRect maps for all colors
    let binRectMapArray_ = [];
    
    for (let c=0; c<nChannels; c++){
        binRectMapArray_.push(new Map());
    }
    
    /**
     * Add all bins within the overlap area.
     * Reject bins with one or more zero pixels.
     * @param {Image} targetImage
     * @param {Image} referenceImage
     * @returns {undefined}
     */
    this.addSampleBins = function(targetImage, referenceImage){
        let xMax = getNumberOfColumns();
        let yMax = getNumberOfRows();
        for (let xKey = 0; xKey < xMax; xKey++){
            for (let yKey = 0; yKey < yMax; yKey++){
                addBinRect(targetImage, referenceImage, xKey, yKey);
            }
        }
    };
    
    /**
     * Remove all bin entries that are fully or partially covered by a star
     * @param {Star[]} stars Must be sorted by flux before calling this function
     * @param {PhotometricMosaicData} data 
     * @param {Number} firstNstars Only use this number of the brightest stars
     * @param {Number} growthRate data.sampleStarGrowthRate or data.sampleStarGrowthRateTarget
     * @param {Number} growthLimit data.sampleStarGrowthLimit or data.sampleStarGrowthLimitTarget
     */
    this.removeBinRectWithStars = function(stars, data, firstNstars, growthRate, growthLimit){
        for (let i=0; i<firstNstars; i++){
            let star = stars[i];
            // This will allow the star to clip the box corner, but that will
            // not significantly affect the bin's median value
            // Increase protection for saturated or almost saturated stars
            let starRadius = calcSampleStarRejectionRadius(star, data, growthRate, growthLimit);
            removeBinsInCircle(star.pos, starRadius);
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
        for (let binRect of binRectMapArray_[channel].values()) {
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
    
    /**
     * @param {Number} channel Get sample rectangles for this color channel
     * @returns {Rect[]} Array of sample grid rectangles 
     */
    this.getBinRectArray = function(channel){
        return binRectMapArray_[channel].values();
    };
    
    // Private methods
    
    /**
     * @param {Number} xKey Nth bin in x direction (starting at zero)
     * @param {Number} yKey Nth bin in y direction (starting at zero)
     * @returns {Point} The (x,y) coordinate of the bin's center
     */
    function getBinCenter(xKey, yKey){
        return new Point(getX(xKey) + binSize_/2, getY(yKey) + binSize_/2);
    }
    /**
     * @returns {Number}
     */
    function getNumberOfColumns(){
        return Math.floor((x1_ - x0_) / binSize_);
    }
    /**
     * 
     * @returns {Number}
     */
    function getNumberOfRows(){
        return Math.floor((y1_ - y0_) / binSize_);
    }
    /**
     * @param {Number} x Any X-Coordinate within a bin, including left edge
     * @returns {Number} Nth sample in x direction (starting at zero)
     */
    function getXKey(x){
        return Math.floor((x - x0_) / binSize_);
    }
    /**
     * @param {Number} y Any Y-Coordinate within a bin, including top edge
     * @returns {Number} Nth sample in y direction (starting at zero)
     */
    function getYKey(y){
        return Math.floor((y - y0_) / binSize_);
    }
    /**
     * @param {Number} xKey Nth bin in x direction (starting at zero)
     * @returns {Number} X-Coordinate of bin's left edge
     */
    function getX(xKey){
        return x0_ + xKey * binSize_;
    }
    /**
     * @param {Number} yKey Nth sample in y direction (starting at zero)
     * @returns {Number} Y-Coordinate of bin's top edge
     */
    function getY(yKey){
        return y0_ + yKey * binSize_;
    }
    /**
     * @param {Number} xKey Nth bin in x direction (starting at zero)
     * @param {Number} yKey Nth bin in y direction (starting at zero)
     * @returns {String} Key has format "xKey,yKey" e.g. "3,28"
     */
    function createKey(xKey, yKey){
        return "" + xKey + "," + yKey;
    }
    
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
     */
    function addBinRect(tgtImage, refImage, xKey, yKey){
        let nChannels = binRectMapArray_.length;
        let binRect = new Rect(binSize_, binSize_);
        binRect.moveTo(getX(xKey), getY(yKey));
        let samples = new Float64Array(binRect.area);
        for (let c=0; c < nChannels; c++){
            // Don't add sample if it contains 1 or more pixels that are black
            let addBinRect = true;
            refImage.getSamples(samples, binRect, c);
            for (let i = 0; i < samples.length; i++) {
                if (samples[i] === 0){
                    addBinRect = false;
                    break;
                }
            }
            if (addBinRect){
                tgtImage.getSamples(samples, binRect, c);
                for (let i = 0; i < samples.length; i++) {
                    if (samples[i] === 0){
                        addBinRect = false;
                        break;
                    }
                }
            }
            if (addBinRect){
                binRectMapArray_[c].set(createKey(xKey, yKey), binRect);
            }
        }
    }
    
    /**
     * Reject bin entries from the map if:
     * DISTANCE > (starRadius + binSize/2)
     * where DISTANCE = (center of star) to (center of bin)
     * @param {Point} p
     * @param {Number} starRadius
     */
    function removeBinsInCircle(p, starRadius) {
        let starToCenter = starRadius + binSize_/2;
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
    }
    
    /**
     * Remove specified binRect from the map
     * @param {Number} xKey Nth sample in x direction (starting at zero)
     * @param {Number} yKey Nth sample in y direction (starting at zero)
     */
    function removeBinRect(xKey, yKey){
        let key = createKey(xKey, yKey);
        for (let c=0; c < binRectMapArray_.length; c++){
            binRectMapArray_[c].delete(key);
        }
    }
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
 * For performance, if there are more than sampleMaxLimit samples, the samples are binned
 * into super samples. The binning in x and y directions may differ to ensure that
 * the 'thickness' of the join is not reduced to less than 5 samples by the binning.
 * @param {Rect} overlapBox
 * @param {SamplePair[]} samplePairs
 * @param {Boolean} isHorizontal
 * @param {Number} sampleMaxLimit
 * @returns {SamplePair[]}
 */
function createBinnedSampleGrid(overlapBox, samplePairs, isHorizontal, sampleMaxLimit){ 
    // Private functions

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
            joinBinning = 2;
            perpBinning = 1;
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
        // Not always the geometrically expected number due to SamplePair rejection (e.g. stars)
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
        let width;
        let height;
        if (area === binWidth * binHeight){
            // fully populated bin
            width = binWidth;
            height = binHeight;
        } else {
            width = Math.sqrt(area);
            height = width;
        }
        let halfWidth = Math.round(width / 2);
        let halfHeight = Math.round(height / 2);
        let x0 = center.x - halfWidth;
        let x1 = x0 + width;
        let y0 = center.y - halfHeight;
        let y1 = y0 + height;
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
    
    {
        const minRows = 5;
        if (samplePairs.length > sampleMaxLimit){
            let binnedSampleArray = createBinnedSamplePairArray(overlapBox, samplePairs, 
                    sampleMaxLimit, minRows, isHorizontal);
            if (binnedSampleArray.length > sampleMaxLimit){
                // This can happen because many samples in grid were rejected due to stars
                sampleMaxLimit *= sampleMaxLimit / binnedSampleArray.length;
                binnedSampleArray = createBinnedSamplePairArray(overlapBox, samplePairs, 
                    sampleMaxLimit, minRows, isHorizontal);
            }
            return binnedSampleArray;
        }
    }
    return samplePairs;
}
