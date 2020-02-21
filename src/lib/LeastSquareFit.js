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

// Some of these functions require the calling script to #include SamplePair

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

/**
 * 
 * @param {Number[]} difArray
 * @param {Number} minValue
 * @param {Number} maxValue
 * @returns {GradientData}
 */
function GradientData(difArray, minValue, maxValue){
    this.difArray = difArray;
    this.minValue = minValue;
    this.maxValue = maxValue;
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

/**
 * Test method and data to check the Least Square Fit algorithm
 */
function testLeastSquareFitAlgorithm() {
    let lsf = new LeastSquareFitAlgorithm();

    let samplePairArray = [];
    samplePairArray.push(new SamplePair(2.0, 0, 4.0, 0, 2, 4));
    samplePairArray.push(new SamplePair(3.0, 0, 5.0, 0, 3, 5));
    samplePairArray.push(new SamplePair(5.0, 0, 7.0, 0, 5, 7));
    samplePairArray.push(new SamplePair(7.0, 0, 10.0, 0, 7, 10));
    samplePairArray.push(new SamplePair(9.0, 0, 15.0, 0, 9, 15));

    lsf.addValues(samplePairArray, getLinearFitX, getLinearFitY);
    let line = lsf.getLinearFit();
    console.writeln("m (1.51829268292682926) = " + line.m);
    console.writeln("b (0.3048780487804878) = " + line.b);
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
