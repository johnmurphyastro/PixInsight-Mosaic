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