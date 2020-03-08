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
 * @returns {LinearFitData}
 */
function LinearFitData(m, b) {
    this.m = m;
    this.b = b;
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
     * Calculate line from data points
     * @return {LinearFitData} Fitted line (y = mx + b)
     */
    this.getLinearFit = function () {
        if (this.n > 1) {
            let m = ((this.n * this.sumXY) - (this.sumX * this.sumY)) /
                    ((this.n * this.sumSquaredX) - (this.sumX * this.sumX));

            let b = (this.sumY - (m * this.sumX)) / this.n;
            return new LinearFitData(m, b);
        } else if (this.n === 1){
            console.warningln("WARNING: Least Squares Fit only has one point. Assuming origin as second point.");
            return new LinearFitData(this.sumY / this.sumX, 0);
        } else {
            console.criticalln("ERROR: Least Squares Fit has no points to fit...");
            return new LinearFitData(1, 0);
        }
    };
    
    /**
     * Calculates the best fit line that goes through the origin.
     * This is particularly helpful for photometry graphs with only a few points
     * These lines should always go through the origin.
     * @returns {LinearFitData}
     */
    this.getOriginFit = function () {
        if (this.n > 0) {
            let m = this.sumXY / this.sumSquaredX;
            return new LinearFitData(m, 0);
        } else {
            console.criticalln("ERROR: Least Squares Origin Fit has no points to fit...");
            return new LinearFitData(1, 0);
        }
    };
}

// ============ PixelMath =============

/**
 * Apply the linear fit to all non zero samples within target image
 * If the resulting pixels are less than zero or greater than 1.0, they are clipped.
 * @param {View} view Target view
 * @param {LinearFitData[]} linearFitColorArray LinearFitData for each channel
 * @param {Boolean} allowUndo
 * @returns {undefined}
 */
function applyLinearFit(view, linearFitColorArray, allowUndo) {
    let P = new PixelMath;
    P.setDescription("Apply Least Squares Fit to " + view.fullId);
    P.symbols = "m0 = " + linearFitColorArray[0].m + ", b0 = " + linearFitColorArray[0].b;
    P.expression0 = "iif($T == 0, 0, $T * m0 + b0)";
    if (3 === linearFitColorArray.length) { // RGB
        P.symbols += ", m1 = " + linearFitColorArray[1].m + ", b1 = " + linearFitColorArray[1].b;
        P.expression1 = "iif($T == 0, 0, $T * m1 + b1)";
        P.symbols += ", m2 = " + linearFitColorArray[2].m + ", b2 = " + linearFitColorArray[2].b;
        P.expression2 = "iif($T == 0, 0, $T * m2 + b2)";
        P.expression3 = "";
        P.useSingleExpression = false;
    } else { // L
        P.useSingleExpression = true;
    }
    P.singleThreaded = false;
    P.use64BitWorkingImage = true;
    P.rescale = false;
    P.truncate = true;
    P.truncateLower = 0;
    P.truncateUpper = 1;
    P.createNewImage = false;
    P.executeOn(view, allowUndo);
}

/**
 * Apply the linear fit scale factor (gradient) to all non zero samples within 
 * the target image. The output image is not truncated to be within the 0 to 1
 * range because the offset/gradient will be applied later on.
 * The scale should always be corrected (via photometry) before the offset or 
 * gradient is calculated.
 * @param {View} view Target view
 * @param {LinearFitData[]} linearFitColorArray LinearFitData for each channel
 * @param {Boolean} allowUndo
 * @returns {undefined}
 */
function applyLinearFitScale(view, linearFitColorArray, allowUndo) {
    let P = new PixelMath;
    P.setDescription("Apply gradient to " + view.fullId);
    P.symbols = "m0 = " + linearFitColorArray[0].m;
    P.expression0 = "iif($T == 0, 0, $T * m0)";
    if (3 === linearFitColorArray.length) { // RGB
        P.symbols += ", m1 = " + linearFitColorArray[1].m;
        P.expression1 = "iif($T == 0, 0, $T * m1)";
        P.symbols += ", m2 = " + linearFitColorArray[2].m;
        P.expression2 = "iif($T == 0, 0, $T * m2)";
        P.expression3 = "";
        P.useSingleExpression = false;
    } else { // L
        P.useSingleExpression = true;
    }
    P.singleThreaded = false;
    P.use64BitWorkingImage = true;
    P.rescale = false;
    P.truncate = false;
    P.createNewImage = false;
    P.executeOn(view, allowUndo);
}

/**
 * Create or append to a mosaic by adding two images together
 * If the MosaicTest image does not exist it is created.
 * Zero pixels are ignored
 * 
 * @param {View} referenceView In overlay mode, displayed on top
 * @param {View} targetView In overlay mode, displayed beneath
 * @param {String} mosaicImageName
 * @param {Boolean} overlayRefFlag Set overlapping pixels to the reference image
 * @param {Boolean} overlayTgtFlag Set overlapping pixels to the target image
 * @param {Boolean} randomFlag Set overlapping pixels randomly to reference or target pixels
 * @returns {undefined}
 */
function createMosaic(referenceView, targetView, mosaicImageName,
        overlayRefFlag, overlayTgtFlag, randomFlag) {
    let mosaicView = View.viewById(mosaicImageName);
    let createMosaicView = mosaicView.isNull;

    let P = new PixelMath;
    P.setDescription("Create Mosaic from " + referenceView.fullId + ", " + targetView.fullId);
    let expression;
    if (overlayRefFlag) {
        expression = format("iif(%s != 0, %s, %s)", referenceView.fullId, referenceView.fullId, targetView.fullId);
    } else if (overlayTgtFlag){
        expression = format("iif(%s != 0, %s, %s)", targetView.fullId, targetView.fullId, referenceView.fullId);
    } else if (randomFlag){
        // iif( A && B, rndselect( A, B ), A + B )
        let A = referenceView.fullId;
        let B = targetView.fullId;
        expression = "iif(" + A + " && " + B + ", rndselect(" + A + ", " + B + "), " + A + " + " + B + ")";
    } else {
        // Average: iif( A && B, mean( A, B ), A + B )
        let A = referenceView.fullId;
        let B = targetView.fullId;
        expression = "iif(" + A + " && " + B + ", (" + A + " + " + B + ")/2, " + A + " + " + B + ")";
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
        P.executeOn(targetView, true); // used to get sample format and color space
    } else {
        P.createNewImage = false;
        P.executeOn(mosaicView, true);
    }

}

//function testLeastSquareFitAlgorithm() {
//    let points = [
//        [2, 4], [3, 5], [5, 7], [7, 10], [9, 15]
//    ];
//    let lsf = new LeastSquareFitAlgorithm();
//    for (let point of points){
//        lsf.addValue(point[0], point[1]);
//    }
//    let line = lsf.getLinearFit();
//    console.writeln("m (1.51829268292682926) = " + line.m);
//    console.writeln("b (0.3048780487804878) = " + line.b);
//    
//    let graphWithAxis = new Graph(0, 0, 9, 15);
//    graphWithAxis.setYAxisLength(1000);
//    graphWithAxis.createGraph("X-TEST", "Y-TEST");
//    graphWithAxis.drawLine(line.m, line.b, 0xFF777777);
//    for (let point of points){
//        graphWithAxis.drawPoint(point[0], point[1], 0xFFFFFFFF);
//    }
//    let imageWindow = graphWithAxis.createWindow("TestLeastSquareFit", false);
//    imageWindow.show();
//}
//function testColorGraph(){
//
//    let red = 4294901760;
//    let green = 4278255360;
//    let blue = 4278190335;
//    let r = [[0.01657698815688491,0.021640867926180363],
//             [0.08511645952239633,0.1092898971401155]];
//    let g = [[0.11742846667766571,0.14592207642272115],
//             [0.08589333295822144,0.10367272654548287]];
//    let b = [[0.11435952689498663,0.12909920839592814],
//             [0.05207112245261669,0.0611232400406152]];
//    
//    let graphWithAxis = new Graph(0.01, 0.01, 0.12, 0.15);
//    graphWithAxis.setYAxisLength(820);
//    graphWithAxis.createGraph("X-TEST", "Y-TEST");
//    testAddOneColor(graphWithAxis, r, 0xFFFF0000, 0xFF770000, "Red");
//    testAddOneColor(graphWithAxis, g, 0xFF00FF00, 0xFF007700, "Green");
//    testAddOneColor(graphWithAxis, b, 0xFF0000FF, 0xFF000077, "Blue");
//    let imageWindow = graphWithAxis.createWindow("TestColorGraph", true);
//    imageWindow.show();
//}
//function testAddOneColor(graphWithAxis, points, pointColor, lineColor, text){
//    let lsf = new LeastSquareFitAlgorithm();
//    for (let point of points){
//        lsf.addValue(point[0], point[1]);
//    }
//    let line = lsf.getLinearFit();
//    console.writeln(text, ": m=", line.m, ", b=", line.b);
//    
//    let graphAreaOnly = graphWithAxis.createGraphAreaOnly();
//    graphAreaOnly.drawLine(line.m, line.b, lineColor);
//    for (let point of points){
//        graphWithAxis.drawPoint(point[0], point[1], pointColor);
//    }
//    graphWithAxis.mergeWithGraphAreaOnly(graphAreaOnly);
//}
//function main() {
//    #include "DialogLib.js"
//    #include "Graph.js"
////    testLeastSquareFitAlgorithm();
//    testColorGraph();
//}
//main();