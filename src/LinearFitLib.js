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
 * @param {Number} target
 * @param {Number} reference
 * @param {Number} x
 * @param {Number} y
 * @returns {SamplePair}
 */
function SamplePair(target, reference, x, y) {
    this.target = target;       // linear fit x coordinate
    this.reference = reference; // linear fit y coordinate
    this.x = x;
    this.y = y;
}

/**
 * y = mx + b
 * @param {Number} m
 * @param {Number} b
 * @param {Rectangle} sampleArea The line was created from samples within this area
 * @returns {LinearFitData}
 */
function LinearFitData(m, b, sampleArea = null) {
    this.m = m;
    this.b = b;
    this.sampleArea = sampleArea;
}

function getLinearFitX(samplePair) {
    return samplePair.target;
}
function getLinearFitY(samplePair) {
    return samplePair.reference;
}

function getHorizontalGradientX(samplePair) {
    return samplePair.x;
}
function getHorizontalGradientY(samplePair) {
    return samplePair.target - samplePair.reference;
}

function getVerticalGradientX(samplePair) {
    return samplePair.y;
}
function getVerticalGradientY(samplePair) {
    return samplePair.target - samplePair.reference;
}

/**
 * Returns the elapsed time since startTime.
 * If the elapsed time is less than a second, it is returned as milliseconds, with a 'ms' postfix.
 * Otherwise it is returned as seconds, with a 's' postfix.
 * @param {Number} startTime
 * @returns {String} Time elapsed since startTime
 */
function getElapsedTime(startTime) {
    let totalTime = new Date().getTime() - startTime;
    if (totalTime < 1000) {
        totalTime += " ms";
    } else {
        totalTime /= 1000;
        totalTime += " s";
    }
    return totalTime;
}

// ============ Algorithms ============
/**
 * Calculate the average value within a rectange for both reference and target images.
 * @param {Image} targetImage
 * @param {Image} referenceImage
 * @param {Number} channel Image channel
 * @param {Number} clipping Samples with pixels > clipping will be excluded.
 * @param {Rectangle} binRect Calculate the average value within this rectangle
 * @return {Object} average reference and target values
 */
function calculateBinAverage(targetImage, referenceImage, channel, clipping, binRect) {
    let nth = 0;
    let referenceSum = 0;
    let targetSum = 0;

    /**
     * @param sample Pixel value to check
     * @param clipping Maximum allowed pixel value
     * @return true if the sample is out of range and should therefore be excluded
     */
    let isBlackOrClipped = (sample, clipping) => sample === 0 || sample > clipping;

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

            targetSum += targetSample;
            referenceSum += referenceSample;
            nth++;
        }
    }

    // return average target value, average reference value, x coord, y coord
    return new SamplePair(targetSum / nth, referenceSum / nth,
            binRect.x + (binRect.width-1) / 2, binRect.y + (binRect.height-1) / 2);
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
 * @param {Number} sampleSize Between 1 and 5 times diameter of brightest stars
 * @param {Number} rejectHigh Ignore samples that contain pixels > rejectHigh
 * @param {Number} rejectBrightestN Remove the N brightest SamplePairs before returning the array
 * @return {SamplePair[]} Array of target and reference binned sample values
 */
function createSamplePairs(targetImage, referenceImage, channel, sampleSize,
        rejectHigh, rejectBrightestN) {
    // Divide the images into blocks specified by sampleSize.
    let binRect = new Rectangle(0, 0, sampleSize, sampleSize);
    let wBinned = Math.trunc(referenceImage.width / binRect.width);
    let hBinned = Math.trunc(referenceImage.height / binRect.height);

    let samplePairArray = [];
    for (let y = 0; y < hBinned; y++) {
        for (let x = 0; x < wBinned; x++) {
            binRect.x = binRect.width * x;
            binRect.y = binRect.height * y;
            let pairedAverage = calculateBinAverage(targetImage, referenceImage, channel, rejectHigh, binRect);
            if (null !== pairedAverage) {
                samplePairArray.push(pairedAverage);
            }
        }
    }

    if (rejectBrightestN > 0) {
        samplePairArray.sort((a, b) => a.reference - b.reference);
        // the array had to be sorted before we could do this
        samplePairArray.length -= rejectBrightestN;
    }

    return samplePairArray;
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
 * @return {SamplePair[]} Array of target and reference binned sample values
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
            let pairedAverage = new SamplePair(targetSample, referenceSample, x, y);
            samplePairArray.push(pairedAverage);
        }
    }

    return samplePairArray;
}

/**
 * Get sample area of coverage
 * @param {SamplePair[]} samplePairArray
 * @returns {Rectangle} Area of coverage
 */
function getSampleArea(samplePairArray){
    let minX = Number.MAX_VALUE;
    let minY = Number.MAX_VALUE;
    let maxX = 0;
    let maxY = 0;
    for (let samplePair of samplePairArray){
        minX = Math.min(minX, samplePair.x);
        maxX = Math.max(maxX, samplePair.x);
        minY = Math.min(minY, samplePair.y);
        maxY = Math.max(maxY, samplePair.y);
    }
    return new Rectangle(minX, minY, maxX - minX, maxY - minY);
}

/**
 * This object calculates Least Square Fit
 * y = mx + b
 * m = (N * Sum(xy) - Sum(x) * Sum(y)) /
 *     (N * Sum(x^2) - (Sum(x))^2)
 * b = (Sum(y) - m * Sum(x)) / N
 */
function LeastSquareFitAlgorithm() {
    // y = reference, x = target
    this.sumX = 0.0;
    this.sumY = 0.0;
    this.sumSquaredX = 0.0;
    this.sumXY = 0.0;
    this.n = 0;

    /**
     * @param {Number} x
     * @param {Number} y
     */
    this.addValue = function (x, y) {
        this.sumX += x;
        this.sumY += y;
        this.sumSquaredX += x * x;
        this.sumXY += x * y;
        this.n++;
    };

    /**
     * Samples for Linear fit line
     * @param {SamplePair[]} samplePairArray
     * @param {Number function(SamplePair)} getX
     * @param {Number function(SamplePair)} getY
     * @returns {undefined}
     */
    this.addValues = function (samplePairArray, getX, getY) {
        samplePairArray.forEach(samplePair => this.addValue(getX(samplePair), getY(samplePair)));
    };

    /**
     * Calculate line from data points
     * @return {LinearFitData} Fitted line (y = mx + b)
     */
    this.getLinearFit = function () {
        let m = ((this.n * this.sumXY) - (this.sumX * this.sumY)) /
                ((this.n * this.sumSquaredX) - (this.sumX * this.sumX));

        let b = (this.sumY - (m * this.sumX)) / this.n;

        return new LinearFitData(m, b);
    };
}

/**
 * Test method and data to check the Least Square Fit algorithm
 */
function testLeastSquareFitAlgorithm() {
    let lsf = new LeastSquareFitAlgorithm();

    let samplePairArray = [];
    samplePairArray.push(new SamplePair(2.0, 4.0, 2, 4));
    samplePairArray.push(new SamplePair(3.0, 5.0, 3, 5));
    samplePairArray.push(new SamplePair(5.0, 7.0, 5, 7));
    samplePairArray.push(new SamplePair(7.0, 10.0, 7, 10));
    samplePairArray.push(new SamplePair(9.0, 15.0, 9, 15));

    lsf.addValues(samplePairArray, getLinearFitX, getLinearFitY);
    let line = lsf.getLinearFit();
    console.writeln("m (1.51829268292682926) = " + line.m);
    console.writeln("b (0.3048780487804878) = " + line.b);
}

/**
 * Calculate 'm' and 'b' for the best Fit line y = mx + b
 * @param {SamplePair[]} samplePairArray
 * @param {Number function(SamplePair)} getX
 * @param {Number function(SamplePair)} getY
 * @returns {LinearFitData} The linear fit details.
 */
function calculateLinearFit(samplePairArray, getX, getY) {
    let algorithm = new LeastSquareFitAlgorithm();
    algorithm.addValues(samplePairArray, getX, getY);
    return algorithm.getLinearFit();
}

// ============ PixelMath =============

/**
 * Apply the linear fit to all non zero samples within target image
 * If the resulting pixels are less than zero or greater than 1.0, they are clipped.
 * @param {View} view Target view
 * @param {LinearFitData[]} line LinearFitData for each channel
 * @returns {undefined}
 */
function applyLinearFit(view, line) {
    let P = new PixelMath;
    P.expression = "iif($T == 0, 0, $T * " + line[0].m + " + " + line[0].b +")";
    if (3 === line.length) { // RGB
        P.expression1 = "iif($T == 0, 0, $T * " + line[1].m + " + " + line[1].b +")";
        P.expression2 = "iif($T == 0, 0, $T * " + line[2].m + " + " + line[2].b +")";
        P.expression3 = "";
        P.useSingleExpression = false;
    } else { // L
        P.useSingleExpression = true;
    }
    P.symbols = "";
    P.singleThreaded = false;
    P.use64BitWorkingImage = true;
    P.rescale = false;
    P.truncate = true;
    P.truncateLower = 0;
    P.truncateUpper = 1;
    P.createNewImage = false;
    P.executeOn(view, true);
}

/**
 * Create or append to a mosaic by adding two images together
 * If the MosaicTest image does not exist it is created.
 * Zero pixels are ignored
 * 
 * @param {View} topView In overlay mode, displayed on top
 * @param {View} bottomView In overlay mode, displayed beneath
 * @param {Boolean} overlayFlag If false, randomly use topView or bottomView in the overlap region
 * @param {String} mosaicImageName
 * @returns {undefined}
 */
function createMosaic(topView, bottomView, overlayFlag, mosaicImageName = "Mosaic") {
    let mosaicView = View.viewById(mosaicImageName);
    let createMosaicView = mosaicView.isNull;

    let P = new PixelMath;
    let expression;
    if (overlayFlag) {
        expression = format("iif(%s != 0, %s, %s)", topView.fullId, topView.fullId, bottomView.fullId);
    } else {
        // iif( A && B, rndselect( A, B ), A + B )
        let A = topView.fullId;
        let B = bottomView.fullId;
        expression = "iif(" + A + " && " + B + ", rndselect(" + A + ", " + B + "), " + A + " + " + B + ")";
    }

    P.expression = expression;
    P.symbols = "";
    P.useSingleExpression = true;
    P.generateOutput = true;
    P.singleThreaded = false;
    P.use64BitWorkingImage = true;
    P.rescale = false;
    P.truncate = false; // Both input images should be within range
    if (createMosaicView) {
        P.createNewImage = true;
        P.showNewImage = true;
        P.newImageId = mosaicImageName;
        P.newImageWidth = 0;
        P.newImageHeight = 0;
        P.newImageAlpha = false;
        P.newImageColorSpace = PixelMath.prototype.SameAsTarget;
        P.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
        P.executeOn(topView, true); // used to get sample format and color space
    } else {
        P.createNewImage = false;
        P.executeOn(mosaicView, true);
    }

}
