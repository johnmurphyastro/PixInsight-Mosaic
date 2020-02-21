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
 * @param {Number} x
 * @param {Number} y
 * @param {Number} width Rectangle width
 * @param {Number} height Rectangle height
 * @returns {Rectangle}
 */
function Rectangle(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
}

/**
 * 
 * @param {Number} targetMean
 * @param {Number} targetMedian
 * @param {Number} referenceMean
 * @param {Number} referenceMedian
 * @param {Number} x X-Coordinate at the center of the sample
 * @param {Number} y Y-Coordinate at the center of the sample
 * @returns {SamplePair}
 */
function SamplePair(targetMean, targetMedian, referenceMean, referenceMedian, x, y) {
    this.targetMean = targetMean;       // linear fit x coordinate
    this.referenceMean = referenceMean; // linear fit y coordinate
    this.targetMedian = targetMedian;
    this.referenceMedian = referenceMedian;
    this.x = x;
    this.y = y;
}

/**
 * @param {type} samplePair
 * @returns {Number} targetMean
 */
function getLinearFitX(samplePair) {
    return samplePair.targetMean;
}
/**
 * @param {type} samplePair
 * @returns {Number} referenceMean
 */
function getLinearFitY(samplePair) {
    return samplePair.referenceMean;
}

/**
 * @param {type} samplePair
 * @returns {Number} x
 */
function getHorizontalGradientX(samplePair) {
    return samplePair.x;
}
/**
 * @param {type} samplePair
 * @returns {Number} targetMedian - referenceMedian
 */
function getHorizontalGradientY(samplePair) {
    return samplePair.targetMedian - samplePair.referenceMedian;
}

/**
 * @param {type} samplePair
 * @returns {Number} y
 */
function getVerticalGradientX(samplePair) {
    return samplePair.y;
}
/**
 * @param {type} samplePair
 * @returns {Number} targetMedian - referenceMedian
 */
function getVerticalGradientY(samplePair) {
    return samplePair.targetMedian - samplePair.referenceMedian;
}

/**
 * Contains SamplePair[]
 * @param {SamplePair[]} samplePairArray
 * @param {Number} sampleSize
 * @param {Rectangle} selectedArea Area selected by user (e.g. via preview)
 * @param {Boolean} hasMedianValues
 * @returns {SamplePairs}
 */
function SamplePairs(samplePairArray, sampleSize, selectedArea, hasMedianValues = false){
    /** SamplePair[] */
    this.samplePairArray = samplePairArray;
    /** Number */
    this.sampleSize = sampleSize;
    /** Boolean */
    this.hasMedianValues = hasMedianValues;
    /** Rectangle */
    this.selectedArea = selectedArea;
    
    /** Rectangle, Private */
    this.sampleArea = null;                             // Private

    /**
     * @returns {Rectangle} Bounding rectangle of all samplePair
     */
    this.getSampleArea = function(){
        if (this.sampleArea === null) {
            let minX = Number.MAX_VALUE;
            let minY = Number.MAX_VALUE;
            let maxX = 0;
            let maxY = 0;
            for (let samplePair of samplePairArray) {
                minX = Math.min(minX, samplePair.x);
                maxX = Math.max(maxX, samplePair.x);
                minY = Math.min(minY, samplePair.y);
                maxY = Math.max(maxY, samplePair.y);
            }
            this.sampleArea = new Rectangle(minX, minY, maxX - minX, maxY - minY);
        }
        return this.sampleArea;
    };
    
    /**
     * Reject the brightest percent from the samplePairArray.
     * Sorts the array based on (referenceMean - referenceMedian) and then
     * removes the values at the end of the array.
     * @param {type} percent Percentage of SamplePair to reject
     * @returns {undefined}
     */
    this.rejectBrightest = function(percent){
        if (this.hasMedianValues && percent > 0) {
            this.samplePairArray.sort((a, b) => (a.referenceMean - a.referenceMedian) - (b.referenceMean - b.referenceMedian));
            // the array had to be sorted before we could do this
            let nSamples = Math.ceil(samplePairArray.length * (100 - percent) / 100);
            this.samplePairArray.length = nSamples;
        }
    };
}


function SamplePairMinMax() {
    this.maxReferenceMean = Number.MIN_VALUE;
    this.maxTargetMean = Number.MIN_VALUE;
    this.minReferenceMean = Number.MAX_VALUE; 
    this.minTargetMean = Number.MAX_VALUE;

    this.calculateMinMax = function(samplePairArray){
        for (let samplePair of samplePairArray) {
            this.maxReferenceMean = Math.max(this.maxReferenceMean, samplePair.referenceMean);
            this.maxTargetMean = Math.max(this.maxTargetMean, samplePair.targetMean);
            this.minReferenceMean = Math.min(this.minReferenceMean, samplePair.referenceMean);
            this.minTargetMean = Math.min(this.minTargetMean, samplePair.targetMean);
        }
    };
    
    this.calculateMax = function(samplePairArray){
        for (let samplePair of samplePairArray) {
            this.maxReferenceMean = Math.max(this.maxReferenceMean, samplePair.referenceMean);
            this.maxTargetMean = Math.max(this.maxTargetMean, samplePair.targetMean);
        }
    };
}

// ============ Algorithms ============

/**
 * Calculate the average value within a rectange for both reference and target images.
 * @param {Image} targetImage
 * @param {Image} referenceImage
 * @param {Number} channel Image channel
 * @param {Number} clipping Samples with pixels > clipping will be excluded.
 * @param {Boolean} calcMedian If true calculate mean and median values. If false, median value will be set to zero
 * @param {Rectangle} binRect Calculate the average value within this rectangle
 * @return {SamplePair} average reference and target values
 */
function calculateBinAverage(targetImage, referenceImage, channel, clipping, calcMedian, binRect) {
    let referenceValues = [];
    let targetValues = [];

    /**
     * @param sample Pixel value to check
     * @param clipping Maximum allowed pixel value
     * @return true if the sample is out of range and should therefore be excluded
     */
    let isBlackOrClipped = (sample, clipping) => sample === 0 || sample > clipping;

    // Process all pixels within sample
    for (let y = 0; y < binRect.height; y++) {
        for (let x = 0; x < binRect.width; x++) {
            let targetSample = targetImage.sample(binRect.x + x, binRect.y + y, channel);
            if (isBlackOrClipped(targetSample, clipping)) {
                return null;
            }

            let referenceSample = referenceImage.sample(binRect.x + x, binRect.y + y, channel);
            if (isBlackOrClipped(referenceSample, clipping)) {
                return null;
            }

            targetValues.push(targetSample);
            referenceValues.push(referenceSample);
        }
    }

    let targetAverage = Math.mean(targetValues);
    let referenceAverage = Math.mean(referenceValues);
    let targetMedian;
    let referenceMedian;
    if (calcMedian){
        targetMedian = Math.median(targetValues);
        referenceMedian = Math.median(referenceValues);
    } else {
        targetMedian = 0;
        referenceMedian = 0;
    }
    // return average target value, average reference value, x coord, y coord
    return new SamplePair(targetAverage, targetMedian, referenceAverage, referenceMedian,
            binRect.x + (binRect.width-1) / 2, binRect.y + (binRect.height-1) / 2);
}

/**
 * Create samplePairArray. Divide the target and reference images into Rectangles.
 * The rectanles have dimension sampleSize * sampleSize.
 * For each rectangle, calculate the average sample value for the specified channel.
 * If either the target or reference rectange contains a black sample or a samples
 * greater than rejectHigh, the SamplePair is not added to the array.
 * Using a super binned sample makes fitting the data to a line more robust because
 * it ensures that stars have the same size (less than a single pixel) in both
 * the target and reference images. SampleSize should be between 1 and 5 times
 * greater than the diameter of bright stars. 3 times works well.
 *
 * @param {Image} targetImage
 * @param {Image} referenceImage
 * @param {Number} channel This number Indicates L=0 or R=0, G=1, B=2
 * @param {Number} sampleSize Between 1 and 5 times diameter of brightest stars
 * @param {Number} rejectHigh Ignore samples that contain pixels > rejectHigh
 * @param {Number} rejectBrightestPercent Remove the N brightest SamplePairs before returning the array
 * @param {Rectangle} selectedArea Reject samples outside this area
 * @param {Boolean} calcMedian If true calculate mean and median values. If false, median value will be set to zero
 * @return {SamplePairs} Array of target and reference binned sample values
 */
function createSamplePairs(targetImage, referenceImage, channel, sampleSize,
        rejectHigh, rejectBrightestPercent, selectedArea, calcMedian = false) {
    // Divide the images into blocks specified by sampleSize.
    let binRect = new Rectangle(0, 0, sampleSize, sampleSize);
    let x1 = selectedArea.x;
    let y1 = selectedArea.y;
    let x2 = selectedArea.x + selectedArea.width - sampleSize;
    let y2 = selectedArea.y + selectedArea.height - sampleSize;
    let samplePairArray = [];
    for (let y = y1; y < y2; y+= sampleSize) {
        for (let x = x1; x < x2; x+= sampleSize) {
            binRect.x = x;
            binRect.y = y;
            let pairedAverage = calculateBinAverage(targetImage, referenceImage, channel, rejectHigh, calcMedian, binRect);
            if (null !== pairedAverage) {
                samplePairArray.push(pairedAverage);
            }
        }
    }
    
    let samplePairs = new SamplePairs(samplePairArray, sampleSize, selectedArea, calcMedian);
    if (calcMedian && rejectBrightestPercent > 0) {
        samplePairs.rejectBrightest(rejectBrightestPercent);
    }
    return samplePairs;
}

/**
 * Create samplePairArray. Divide the target and reference images into Rectangles.
 * The rectanles have dimension sampleSize x sampleSize.
 * For each rectangle, calculate the average sample value for the specified channel.
 * If either the target or reference rectange contains a black sample or a samples
 * greater than rejectHigh, the SamplePair is not added to the array.
 * Using a super binned sample makes fitting the data to a line more robust because
 * it ensures that stars have the same size (less than a single pixel) in both
 * the target and reference images. SampleSize should be between 1 and 5 times
 * greater than the diameter of bright stars. 3 times works well.
 *
 * @param {Image} targetImage
 * @param {Image} referenceImage
 * @param {Number} channel This number Indicates L=0 or R=0, G=1, B=2
 * @param {Number} rejectHigh Ignore samples that contain pixels > rejectHigh
 * @return {SamplePairs} Array of target and reference binned sample values
 */
function createCfaSamplePairs(targetImage, referenceImage, channel, rejectHigh) {
    // Divide the images into blocks specified by sampleSize.
    let w = referenceImage.width;
    let h = referenceImage.height;
    let firstY = channel < 2 ? 0 : 1;
    let firstX;
    if (channel === 1 || channel === 3){
        firstX = 0;
    } else {
        firstX = 1;
    }

    /**
     * @param sample Pixel value to check
     * @param rejectHigh Maximum allowed pixel value
     * @return true if the sample is out of range and should therefore be excluded
     */
    let isBlackOrClipped = (sample, rejectHigh) => sample === 0 || sample > rejectHigh;

    let samplePairArray = [];
    for (let y = firstY; y < h; y+=2) {
        for (let x = firstX; x < w; x+=2) {
            let targetSample = targetImage.sample(x, y, 0);
            if (isBlackOrClipped(targetSample, rejectHigh)) {
                continue;
            }
            let referenceSample = referenceImage.sample(x, y, 0);
            if (isBlackOrClipped(referenceSample, rejectHigh)) {
                continue;
            }
            let pairedAverage = new SamplePair(targetSample, 0, referenceSample, 0, x, y);
            samplePairArray.push(pairedAverage);
        }
    }

    let selectedArea = new Rectangle(0, 0, w, h);
    return new SamplePairs(samplePairArray, 1, selectedArea, false);
}
