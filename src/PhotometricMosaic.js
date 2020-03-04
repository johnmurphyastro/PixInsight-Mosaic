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
"use strict";
#feature-id Utilities > Photometric Mosaic

#feature-info Calculates scale and gradient offset between two images over their overlapping area.<br/>\
Copyright & copy; 2019 John Murphy. GNU General Public License.<br/>

#include <pjsr/UndoFlag.jsh>
#include "lib/DialogLib.js"
#include "lib/SamplePair.js"
#include "lib/LeastSquareFit.js"
#include "lib/Graph.js"
#include "lib/StarLib.js"

function VERSION(){return  "1.0";}
function TITLE(){return "Photometric Mosaic";}
function HORIZONTAL(){return 0;}
function VERTICAL(){return 1;}
function AUTO(){return 2;}
function MOSAIC_NAME(){return "Mosaic";}

/**
 * Controller. Processing starts here!
 * @param {PhotometricMosaicData} data Values from user interface
 */
function PhotometricMosaic(data)
{
    let startTime = new Date().getTime();
    let targetView = data.targetView;
    let referenceView = data.referenceView;
    let nChannels = targetView.image.isColor ? 3 : 1;      // L = 0; R=0, G=1, B=2

    console.writeln("Reference: ", referenceView.fullId, ", Target: ", targetView.fullId);

    let samplePreviewArea;
    if (data.hasAreaOfInterest) {
        samplePreviewArea = new Rect(data.areaOfInterest_X0, data.areaOfInterest_Y0, data.areaOfInterest_X1, data.areaOfInterest_Y1);
    } else {
        samplePreviewArea = targetView.image.bounds;
    }

    let detectStarTime = new Date().getTime();
    let detectedStars = new StarsDetected();
    detectedStars.detectStars(referenceView, targetView, samplePreviewArea, data.logStarDetection);
    let colorStarPairs = getColorStarPairs(detectedStars, referenceView.image, targetView.image, data.rejectHigh);
    console.writeln("Detected " + detectedStars.allStars.length + " stars (", getElapsedTime(detectStarTime), ")");
    if (targetView.image.isColor){
        console.writeln("Stars used for photometry: red " + colorStarPairs[0].starPairArray.length + 
                ", green " + colorStarPairs[1].starPairArray.length + 
                ", blue " + colorStarPairs[2].starPairArray.length);
    } else {
        console.writeln("Stars used for photometry: " + colorStarPairs[0].starPairArray.length);
    }
    
    if (data.testMaskOnly){
        displayMask(targetView, detectedStars.allStars, data.limitMaskStarsPercent, data.radiusMult, data.radiusAdd, true);
        displayMask(targetView, detectedStars.allStars, data.limitMaskStarsPercent, data.radiusMult, data.radiusAdd, false);
        console.writeln("\n" + TITLE() + ":Mask Creation Total time ", getElapsedTime(startTime));
        return;
    }

    // Apply scale to target image. Must be done before calculating the gradient
    targetView.beginProcess();
    let scaleFactor = [];
    for (let c = 0; c < nChannels; c++){
        // For each color
        let starPairs = colorStarPairs[c];
        starPairs.linearFitData = calculateScale(starPairs);
        scaleFactor.push(starPairs.linearFitData);
        console.writeln("Scaling ", targetView.fullId, " channel[", c, "] x ", 
                starPairs.linearFitData.m.toPrecision(5) );
    }
    applyLinearFit(targetView, scaleFactor, false);

    let colorSamplePairs = createColorSamplePairs(targetView.image, referenceView.image,
        data.sampleSize, detectedStars.allStars, data.rejectHigh, data.limitSampleStarsPercent, samplePreviewArea);
    let samplePairs = colorSamplePairs[0];
    if (samplePairs.samplePairArray.length < 2) {
        new MessageBox("Error: Too few samples to determine a linear fit.", TITLE(), StdIcon_Error, StdButton_Ok).execute();
        return;
    }

    let sampleArea = samplePairs.getSampleArea();
    let isHorizontal = isJoinHorizontal(data, sampleArea);

    let gradientArray = [];
    let eqnLineArray = [];
    // For each channel (L or RGB)
    // Calculate the linear fit line y = mx + b
    // Display graph of fitted line and sample points
    for (let channel = 0; channel < nChannels; channel++) {
        samplePairs = colorSamplePairs[channel];
        // Divide into sections and calculate linearFit
        let nLineSegments = (data.nLineSegments + 1) / 2;
        let sampleSections = getSampleSections(samplePairs, nLineSegments, isHorizontal);
        sampleSections = joinSectionLines(sampleSections);
        eqnLineArray[channel] = createGradientLines(sampleSections, samplePreviewArea, targetView.image, isHorizontal); 
        gradientArray[channel] = createGradient(eqnLineArray[channel]);

        let average = Math.mean(gradientArray[channel].difArray);
        console.writeln("Channel[", channel, "] average offset ", average.toPrecision(5));
    }

    let applyGradientTime = new Date().getTime();
    applyGradient(targetView, isHorizontal, gradientArray);
    console.writeln("Applied gradients (", getElapsedTime(applyGradientTime), ")\n");

    // Save parameters to PixInsight history
    data.saveParameters();
    targetView.endProcess();

    if (data.displayStarsFlag) {
        let time = new Date().getTime();
        for (let i = 0; i < colorStarPairs.length; i++) {
            let starPairs = colorStarPairs[i];
            displayDetectedStars(targetView, starPairs.starPairArray, i, referenceView.image.isColor);
        }
        console.writeln("Displaying photometric stars... (", getElapsedTime(time), ")");
    }

    if (data.displayGradientFlag){
        let time = new Date().getTime();
        let title = "Gradient_" + targetView.fullId;
        displayGradient(targetView, title, isHorizontal, gradientArray);
        console.writeln("Created gradient image... (", getElapsedTime(time), ")");
    }

    if (data.displaySamplesFlag){
        let time = new Date().getTime();
        let title = "Samples_" + targetView.fullId;
        displaySampleSquares(referenceView, colorSamplePairs[0], detectedStars.allStars, data.limitSampleStarsPercent, title);
        console.writeln("Displaying samples... (", getElapsedTime(time), ")");
    }

    if (data.photometryGraphFlag){
        let time = new Date().getTime();
        displayStarGraph(referenceView, targetView, 730, colorStarPairs);
        console.writeln("Displaying photometry graph... (", getElapsedTime(time), ")");
    }

    if (data.displayGraphFlag) {
        let time = new Date().getTime();
        displayGraph(targetView, referenceView, 1000, isHorizontal, gradientArray, colorSamplePairs, eqnLineArray);
        console.writeln("Displaying gradient graph... (", getElapsedTime(time), ")");
    }

    if (data.displayMosiacFlag){
        console.writeln("Creating ", MOSAIC_NAME());
        createMosaic(referenceView, targetView, data.mosaicOverlayFlag, MOSAIC_NAME()); 
    }
    
    if (data.displayMaskFlag){
        let time = new Date().getTime();
        displayMask(targetView, detectedStars.allStars, data.limitMaskStarsPercent, data.radiusMult, data.radiusAdd, true);
        console.writeln("Created mask for ", targetView.fullId, " (", getElapsedTime(time), ")");
    }
    console.writeln("\n" + TITLE() + ": Total time ", getElapsedTime(startTime));
}

/**
 * 
 * @param {StarDetector} detectedStars
 * @param {Image} refImg
 * @param {Image} tgtImg
 * @param {Number} upperLimit Only use stars within camera's linear range
 * @returns {StarPairs[]} Array of StarPairs for all color channels
 */
function getColorStarPairs(detectedStars, refImg, tgtImg, upperLimit){
    let colorStarPairs = [];
    let nChannels = refImg.isColor ? 3 : 1;
    for (let channel=0; channel < nChannels; channel++){
        let refStars = detectedStars.refColorStars[channel];
        let tgtStars = detectedStars.tgtColorStars[channel];
        let starPairs = findMatchingStars(refImg, refStars, tgtImg, tgtStars, channel, upperLimit);
        colorStarPairs.push(starPairs);
    }
    return colorStarPairs;
}

/**
 * @param {StarPairs} starPairs
 * @returns {LinearFitData} Least Square Fit between reference & target star flux
 */
function calculateScale(starPairs) {
    let leastSquareFit = new LeastSquareFitAlgorithm();
    for (let starPair of starPairs.starPairArray) {
        leastSquareFit.addValue(starPair.getTgtFlux(), starPair.getRefFlux());
    }
    // We are only interested in the scale, not the intercept.
    // Any intercept would be an artifact of the photometry
    let linearFit = leastSquareFit.getLinearFit();
    linearFit.b = 0;
    return linearFit;
}

/**
 * Split the sample coverage area into sections and calculate the gradient linear fit
 * for each section.
 * Returns an array of all the sections.
 * @param {SamplePairs} samplePairs Contains the SamplePairArray and selection areas )
 * @param {Number} nSections The number of sections to create
 * @param {Boolean} isHorizontal True if the mosaic join is a horizontal strip
 * @returns {SampleSection[]}
 */
function getSampleSections(samplePairs, nSections, isHorizontal){
    // Start the first section at the start of the SamplePair area
    let sampleAreaStart;
    let sampleAreaEnd;
    let sampleCoverageArea = samplePairs.getSampleArea();
    if (isHorizontal){
        sampleAreaStart = sampleCoverageArea.x0;
        sampleAreaEnd = sampleCoverageArea.x1;
    } else {
        sampleAreaStart = sampleCoverageArea.y0;
        sampleAreaEnd = sampleCoverageArea.y1;
    }
    let interval = (sampleAreaEnd - sampleAreaStart) / nSections;

    // Split the SamplePair area into sections of equal size.
    let sections = [];
    for (let i=0; i<nSections; i++){
        // ...Coord is x if horizontal join, y if vertical join
        let minCoord = Math.floor(sampleAreaStart + interval * i);
        let maxCoord = Math.floor(sampleAreaStart + interval * (i+1));
        let newSampleSection = new SampleSection(minCoord, maxCoord, isHorizontal);
        newSampleSection.calcLinearFit(samplePairs);
        sections[i] = newSampleSection;
    }
    return sections;
}

/**
 * Represents a single section of the mosaic join
 * @param {type} minCoord Minimum coordinate of section boundary
 * @param {type} maxCoord Maximum coordinate of section boundary
 * @param {type} isHorizontal
 * @returns {SampleSection}
 */
function SampleSection(minCoord, maxCoord, isHorizontal){
    this.linearFitData = null;
    this.minCoord = minCoord;
    this.maxCoord = maxCoord;
    this.isHorizontal = isHorizontal;

    /**
     * Determine which SamplePair are within this section's area, store them
     * and calculate their linear fit
     * @param {SamplePairs} samplePairs Contains samplePairArray
     * @returns {undefined}
     */
    this.calcLinearFit = function (samplePairs) {
        let samplePairArray = [];
        for (let samplePair of samplePairs.samplePairArray) {
            // Discover which SamplePair are within this section's area and store them
            if (this.isHorizontal) {
                const x = samplePair.rect.center.x;
                if (x >= this.minCoord && x < this.maxCoord) {
                    samplePairArray.push(samplePair);
                }
            } else {
                const y = samplePair.rect.center.y;
                if (y >= this.minCoord && y < this.maxCoord) {
                    samplePairArray.push(samplePair);
                }
            }
        }
        // Calculate the linear fit
        let algorithm = new LeastSquareFitAlgorithm();
        if (isHorizontal) {
            samplePairArray.forEach((samplePair) => {
                algorithm.addValue(samplePair.rect.center.x, samplePair.targetMedian - samplePair.referenceMedian);
            });
        } else {
            samplePairArray.forEach((samplePair) => {
                algorithm.addValue(samplePair.rect.center.y, samplePair.targetMedian - samplePair.referenceMedian);
            });
        }
        this.linearFitData = algorithm.getLinearFit();
    };

    /**
     * Calculate this section's linear fit line from where two lines intersect this section's boundary.
     * We first calculate the two intersection points:
     * The first point is where the line linearFit0 intersects with this section's minimum boundary.
     * The second point is where the line linearFit1 intersects with this section's maximum boundary.
     * We can then calculate the equation of the line that joins these two points.
     * This method is used when we insert a new section between two others inorder
     * to round off the gradient curve corners.
     * @param {LinearFitData} linearFit0 Line that intersects this sections minimum boundary
     * @param {LinearFitData} linearFit1 Line that intersects this sections maximum boundary
     * @returns {undefined}
     */
    this.calcLineBetween = function(linearFit0, linearFit1){
        // y = mx + b
        // m = (y1 - y0)/(x1 - x0)
        // b = y0 - m * x0
        let x0 = this.minCoord;
        let x1 = this.maxCoord;
        let y0 = eqnOfLineCalcY(x0, linearFit0.m, linearFit0.b);
        let y1 = eqnOfLineCalcY(x1, linearFit1.m, linearFit1.b);
        let m = eqnOfLineCalcGradient(x0, y0, x1, y1);
        let b = eqnOfLineCalcYIntercept(x0, y0, m);
        this.linearFitData = new LinearFitData(m, b);
    };
}

/**
 * Join section lines together by adding dummy SampleSection between each genuine one.
 * The boundaries of the existing SampleSection's are adjusted to make room.
 * The new SampleSection contains a line that 'cuts the corner' between
 * where the original lines ended
 * @param {SampleSection[]} sampleSections
 * @returns {SampleSection[]}
 */
function joinSectionLines(sampleSections){
    if (sampleSections.length > 1) {
        // Calculate how far to move the existing SampleSection boundaries.
        // The newly inserted SampleSection will be (dist * 2) wide.
        let s = sampleSections[1];
        let dist = Math.round((s.maxCoord - s.minCoord) / 6);
        if (dist < 6) {
            return sampleSections;
        }
        let roundedSampleSections = [];
        let s0 = sampleSections[0];
        for (let i = 1; i < sampleSections.length; i++) {
            let s1 = sampleSections[i];
            s0.maxCoord -= dist;
            s1.minCoord += dist;
            // Create a new dummy SampleSection. It will not contain any samples,
            // but we do calcuate and set its 'linear fit' line which joins it to
            // the previous and next SampleSection's
            let ss = new SampleSection(s0.maxCoord, s1.minCoord, s0.isHorizontal);
            ss.calcLineBetween(s0.linearFitData, s1.linearFitData);
            roundedSampleSections.push(s0);
            roundedSampleSections.push(ss);
            s0 = s1;
        }
        roundedSampleSections.push(s0);
        sampleSections = roundedSampleSections;
    }

    return sampleSections;
}
/**
 * Create the gradient as an array of pixel differences, stored in the GradientData structure.
 *
 * @param {EquationOfLine[]} eqnLines EquationOfLine array
 * @returns {GradientData}
 */
function createGradient(eqnLines) {
    let minValue = Number.POSITIVE_INFINITY;
    let maxValue = Number.NEGATIVE_INFINITY;
    
    let difArray = [];
    for (let eqnLine of eqnLines){
        minValue = Math.min(minValue, eqnLine.y0);
        maxValue = Math.max(maxValue, eqnLine.y0);
        for (let x = eqnLine.x0; x < eqnLine.x1; x++){
            difArray.push(eqnLine.calcYFromX(x));
        }
    }
    
    let eqnLine = eqnLines[eqnLines.length - 1];
    minValue = Math.min(minValue, eqnLine.y1);
    maxValue = Math.max(maxValue, eqnLine.y1);
    
    if (difArray.length !== eqnLines[eqnLines.length-1].x1) {
        console.criticalln("Error: DifArray length = " + difArray.length + "image size = " + eqnLines[eqnLines.length-1].x1);
    }
    return new GradientData(difArray, minValue, maxValue);
}

/**
 * How the difference lines are calculated:
 * (1) The SampleArea is the bounding rectangle of all the SamplePairs.
 * (2) The previewArea is the area selected by the user (e.g. by a preview). If
 * the user made no selection, the previewArea is the area as the image. The
 * SampleArea is a subset of the previewArea (it can be the same size, but not bigger.)
 * (3) The SampleArea is divided into SampleSection. Each of these sections
 * defines a gradient line. The dif value within the sample area is calculated
 * from the equation of this line: dif = mx + b
 * (4) From the start of the image to the start of the previewArea, the dif value
 * is held constant.
 * (5) From the start of the previewArea (or the start of the image if the
 * preview area does not exist) to the first SampleSection, the line from that first
 * SampleSection is extended.
 * (6) From the last SampleSection to the end of the previewArea (or the end of
 * the image if the preview area does not exist) the line from that last
 * SampleSection is extended.
 * (7) From the end of the previewArea to the end of the image, the dif value
 * is held constant.
 * @param {SampleSection[]} sections
 * @param {Rect} previewArea
 * @param {Image} targetImage
 * @param {Boolean} isHorizontal
 * @returns {EquationOfLine[]}
 */
function createGradientLines(sections, previewArea, targetImage, isHorizontal){
    let previewMin;
    let previewMax;
    let imageMax;
    if (isHorizontal) {
        previewMin = previewArea.x0;
        previewMax = previewArea.x1;
        imageMax = targetImage.width;
    } else {
        previewMin = previewArea.y0;
        previewMax = previewArea.y1;
        imageMax = targetImage.height;
    }
    
    let eqnOfLines = [];
    if (previewMin > 0){
        // First horizontal line to start of preview
        // The first line is horizontal (gradient = 0)
        // and intersects the first section line at previewMin
        let linearFitData = sections[0].linearFitData;
        let b = eqnOfLineCalcY(previewMin, linearFitData.m, linearFitData.b);
        eqnOfLines.push(new EquationOfLine(0, b, 0, previewMin));
    }
    
    // Each section
    for (let i = 0; i < sections.length; i++){
        let x0 = (i===0 ? previewMin : sections[i].minCoord);
        let x1 = (i===sections.length - 1 ? previewMax : sections[i].maxCoord);
        let m = sections[i].linearFitData.m;
        let b = sections[i].linearFitData.b;
        eqnOfLines.push(new EquationOfLine(m, b, x0, x1));
    }
    
    // From end of sections to end of preview (or end of image)
    if (previewMax < imageMax){
        // The last line is horizontal (gradient = 0)
        // and intersects the last section line at previewMax
        let linearFitData = sections[sections.length-1].linearFitData;
        let b = eqnOfLineCalcY(previewMax, linearFitData.m, linearFitData.b);
        eqnOfLines.push(new EquationOfLine(0, b, previewMax, imageMax));
    }
    
    return eqnOfLines;    
}

/**
 * Display graph of (difference between images) / (pixel distance across image)
 * @param {View} targetView Used for view name and image size (max graph size is limited to image size)
 * @param {View} referenceView Used for view name
 * @param {Number} width Width or Height. Limited to target image size.
 * @param {Boolean} isHorizontal
 * @param {GradientData[]} gradientArray Only used for stored min/max difference values
 * @param {SamplePairs[]} colorSamplePairs The SamplePair points to be displayed (array contains color channels)
 * @param {EquationOfLine[]} eqnLineArray The best fit lines of difference against coordinate
 * @returns {undefined}
 */
function displayGraph(targetView, referenceView, width, isHorizontal, gradientArray, colorSamplePairs, eqnLineArray){
    let axisWidth;
    let maxCoordinate;
    let imageWindow = null;
    let windowTitle = "GradientBetween_" + targetView.fullId + "_and_" + referenceView.fullId + "_LeastSquaresFit";
    let xLabel;
    if (isHorizontal){
        xLabel = "Mosaic tile join X-coordinate";
        maxCoordinate = targetView.image.width;
    } else {
        xLabel = "Mosaic tile join Y-coordinate";
        maxCoordinate = targetView.image.height;
    }
    let yLabel = "(" + targetView.fullId + ") - (" + referenceView.fullId + ")";
    axisWidth = Math.min(width, maxCoordinate);
    // Graph scale
    // gradientArray stores min / max of fitted lines.
    // also need min / max of sample points.
    const minScaleDif = 1e-4;
    let minMax = new SamplePairDifMinMax(colorSamplePairs, gradientArray);
    let maxY = minMax.maxDif;
    let minY = minMax.minDif;
    if (maxY - minY < minScaleDif){
        maxY += minScaleDif;
        minY -= minScaleDif;
    }
    let graphWithAxis = new Graph(0, minY, maxCoordinate, maxY);
    graphWithAxis.setAxisLength(axisWidth + 2, 720);
    graphWithAxis.createGraph(xLabel, yLabel);

    if (colorSamplePairs.length === 1){ // B&W
        drawLineAndPoints(graphWithAxis, isHorizontal, eqnLineArray[0], 0xFFFFFFFF,
            colorSamplePairs[0], 0xFFFFFFFF);
        imageWindow = graphWithAxis.createWindow(windowTitle, false);
    } else {
        // Color. Need to create 3 graphs for r, g, b and then merge them (binary OR) so that
        // if three samples are on the same pixel we get white and not the last color drawn
        let lineColors = [0xFFFF0000, 0xFF00FF00, 0xFF0000FF]; // r, g, b
        let pointColors = [0xFFFF0000, 0xFF00FF00, 0xFF0000FF]; // r, g, b
        for (let c = 0; c < colorSamplePairs.length; c++){
            let graphAreaOnly = graphWithAxis.createGraphAreaOnly();
            drawLineAndPoints(graphWithAxis, isHorizontal, eqnLineArray[c], lineColors[c],
                colorSamplePairs[c], pointColors[c]);
            graphWithAxis.mergeWithGraphAreaOnly(graphAreaOnly);
        }
        imageWindow = graphWithAxis.createWindow(windowTitle, true);
    }
    imageWindow.show();
}

/**
 * Draw gradient line and sample points for a single color channel.
 * @param {Graph} graph
 * @param {Boolean} isHorizontal
 * @param {EquationOfLine[]} eqnLines
 * @param {Number} lineColor
 * @param {SamplePairs} samplePairs
 * @param {Number} pointColor
 * @returns {undefined}
 */
function drawLineAndPoints(graph, isHorizontal, eqnLines, lineColor, samplePairs, pointColor) {
    for (let eqnLine of eqnLines){
        graph.drawLineSegment(eqnLine.m, eqnLine.b, lineColor, true, eqnLine.x0, eqnLine.x1);
    }
    for (let samplePair of samplePairs.samplePairArray) {
        // Draw the sample points
        let dif = samplePair.targetMedian - samplePair.referenceMedian;
        let coord;
        if (isHorizontal) {
            coord = samplePair.rect.center.x;
        } else {
            coord = samplePair.rect.center.y;
        }
        graph.drawPoint(coord, dif, pointColor);
    }
}

/**
 * Calculates maximum and minimum values for the samples and the best fit line(s)
 * @param {type} colorSamplePairs
 * @param {GradientData} gradientData
 * @returns {SamplePairDifMinMax}
 */
function SamplePairDifMinMax(colorSamplePairs, gradientData) {
    if (gradientData.length === 3){
        this.minDif = Math.min(gradientData[0].minValue, gradientData[1].minValue, gradientData[2].minValue);
        this.maxDif = Math.max(gradientData[0].maxValue, gradientData[1].maxValue, gradientData[2].maxValue);
    } else {
        this.minDif = gradientData[0].minValue;
        this.maxDif = gradientData[0].maxValue;
    }

    for (let samplePairs of colorSamplePairs) {
        for (let samplePair of samplePairs.samplePairArray) {
            // works for both horizontal and vertical
            this.minDif = Math.min(this.minDif, samplePair.targetMedian - samplePair.referenceMedian);
            this.maxDif = Math.max(this.maxDif, samplePair.targetMedian - samplePair.referenceMedian);
        }
    }
}

/**
 * Display the detected gradient to the user
 * @param {View} targetView Create a new image with the same dimensions as the target image
 * @param {String} title Title for the displayed gradient window
 * @param {Boolean} isHorizontal True if displaying a horizontal gradient
 * @param {GradientArray[]} gradientArray One GradientData structure for each channel.
 * @returns {undefined}
 */
function displayGradient(targetView, title, isHorizontal, gradientArray) {
    // Create ImageWindow and View
    let nChannels = gradientArray.length;
    let targetImage = targetView.image;
    let window = new ImageWindow(targetImage.width, targetImage.height,
            nChannels, targetImage.bitsPerSample, targetImage.isReal, targetImage.isColor, title);
    let view = window.mainView;

    let minValue = Number.POSITIVE_INFINITY;
    for (let channel = 0; channel < nChannels; channel++){
        minValue = Math.min(minValue, gradientArray[channel].minValue);
    }

    view.beginProcess(UndoFlag_NoSwapFile);

    for (let channel = 0; channel < nChannels; channel++) {
        let difArray = gradientArray[channel].difArray;
        for (let y = 0; y < targetImage.height; y++) {
            for (let x = 0; x < targetImage.width; x++) {
                if (targetImage.sample(x, y, channel) !== 0) {
                    let value;
                    if (isHorizontal) {
                        value = difArray[x];
                    } else {
                        value = difArray[y];
                    }
                    if (minValue < 0) {
                        value -= minValue;
                    }
                    view.image.setSample(value, x, y, channel);
                }
            }
        }
    }



    view.endProcess();
    window.show();
}


/**
 * Subtract the detected gradient from the target view
 * @param {View} view Apply the gradient correction to this view
 * @param {Boolean} isHorizontal True if we are applying a horizontal gradient
 * @param {Number[].GradientData} gradientArray ColourChannel.GradientData diff data
 * @returns {undefined}
 */
function applyGradient(view, isHorizontal, gradientArray) {
    let nChannels = gradientArray.length;
    let targetImage = view.image;

    for (let channel = 0; channel < nChannels; channel++) {
        let difArray = gradientArray[channel].difArray;
        for (let y = 0; y < targetImage.height; y++) {
            for (let x = 0; x < targetImage.width; x++) {
                let sample = targetImage.sample(x, y, channel);
                if (sample !== 0) {
                    let value;
                    if (isHorizontal) {
                        value = sample - difArray[x];
                    } else {
                        value = sample - difArray[y];
                    }
                    view.image.setSample(value, x, y, channel);
                }
            }
        }
    }
    let minValue = view.image.minimum();
    let maxValue = view.image.maximum();
    if (minValue < 0 || maxValue > 1){
        console.warningln(view.fullId + ": min value = " + minValue + ", max value = " + maxValue + "\nTruncating image...");
        view.image.truncate(0, 1);
    }
}

/**
 *
 * @param {Data} data
 * @param {Rect} sampleArea
 * @returns {Boolean} True if the mosaic join is mostly horizontal
 */
function isJoinHorizontal(data, sampleArea){
    if (data.orientation === HORIZONTAL()){
        console.writeln("<b>Mode: Horizontal Gradient</b>");
        return true;
    }
    if (data.orientation === VERTICAL()){
        console.writeln("<b>Mode: Vertical Gradient</b>");
        return false;
    }
    let isHorizontal = sampleArea.width > sampleArea.height;
    if (isHorizontal) {
        console.writeln("\n<b>Mode auto selected: Horizontal Gradient</b>");
    } else {
        console.writeln("\n<b>Mode auto selected: Vertical Gradient</b>");
    }
    return isHorizontal;
}

/**
 * Default the Reference view to the open view named "Mosaic".
 * If this view does not exist, default to any view that is NOT the current view
 * (the Target view will be set to the current view)
 * @param {ImageWindow} activeWindow
 * @return {View} default reference view
 */
function getDefaultReferenceView(activeWindow) {
    // Get access to the active image window
    let allWindows = ImageWindow.openWindows;
    let referenceView = null;
    for (let win of allWindows) {
        if (win.currentView.fullId.toLowerCase().contains("mosaic")) {
            referenceView = win.currentView;
            break;
        }
    }
    if (null === referenceView) {
        for (let win of allWindows) {
            if (activeWindow.currentView.fullId !== win.currentView.fullId) {
                referenceView = win.currentView;
                break;
            }
        }
    }
    return referenceView;
}

// -----------------------------------------------------------------------------
// Form/Dialog data
// -----------------------------------------------------------------------------
function PhotometricMosaicData() {
    // Used to poplulate the contents of a saved process icon
    // It would normally also be called at the end of our script to populate the history entry,
    // but because we use PixelMath to modify the image, the history entry is automatically populated.
    this.saveParameters = function () {
        if (this.targetView.isMainView) {
            Parameters.set("targetView", this.targetView.fullId);
        }
        if (this.referenceView.isMainView) {
            Parameters.set("referenceView", this.referenceView.fullId);
        }
        Parameters.set("starDetection", this.logStarDetection);
        Parameters.set("displayStars", this.displayStarsFlag);
        Parameters.set("photometryGraph", this.photometryGraphFlag);
        Parameters.set("orientation", this.orientation);
        Parameters.set("rejectHigh", this.rejectHigh);
        Parameters.set("sampleSize", this.sampleSize);
        Parameters.set("limitSampleStarsPercent", this.limitSampleStarsPercent);
        Parameters.set("nLineSegments", this.nLineSegments);
        Parameters.set("displayGradientFlag", this.displayGradientFlag);
        Parameters.set("displayGraphFlag", this.displayGraphFlag);
        Parameters.set("displaySamplesFlag", this.displaySamplesFlag);
        Parameters.set("displayMosiacFlag", this.displayMosiacFlag);
        Parameters.set("mosiacOverlayFlag", this.mosaicOverlayFlag);
        Parameters.set("displayMaskFlag", this.displayMaskFlag);
        Parameters.set("testMaskOnly", this.testMaskOnly);
        Parameters.set("limitMaskStarsPercent", this.limitMaskStarsPercent);
        Parameters.set("multiplyStarRadius", this.radiusMult);
        Parameters.set("addStarRadius", this.radiusAdd);
        
        Parameters.set("hasAreaOfInterest", this.hasAreaOfInterest);
        Parameters.set("areaOfInterest_X0", this.areaOfInterest_X0);
        Parameters.set("areaOfInterest_Y0", this.areaOfInterest_Y0);
        Parameters.set("areaOfInterest_X1", this.areaOfInterest_X1);
        Parameters.set("areaOfInterest_Y1", this.areaOfInterest_Y1);
    };

    // Reload our script's data from a process icon
    this.loadParameters = function () {
        if (Parameters.has("starDetection"))
            this.logStarDetection = Parameters.getReal("starDetection");
        if (Parameters.has("displayStars"))
            this.displayStarsFlag = Parameters.getBoolean("displayStars");
        if (Parameters.has("photometryGraph"))
            this.photometryGraphFlag = Parameters.getBoolean("photometryGraph");
        if (Parameters.has("orientation"))
            this.orientation = Parameters.getInteger("orientation");
        if (Parameters.has("rejectHigh"))
            this.rejectHigh = Parameters.getReal("rejectHigh");
        if (Parameters.has("sampleSize"))
            this.sampleSize = Parameters.getInteger("sampleSize");
        if (Parameters.has("limitSampleStarsPercent"))
            this.limitSampleStarsPercent = Parameters.getInteger("limitSampleStarsPercent");
        if (Parameters.has("nLineSegments"))
            this.nLineSegments = Parameters.getInteger("nLineSegments");
        if (Parameters.has("displayGradientFlag"))
            this.displayGradientFlag = Parameters.getBoolean("displayGradientFlag");
        if (Parameters.has("displayGraphFlag"))
            this.displayGraphFlag = Parameters.getBoolean("displayGraphFlag");
        if (Parameters.has("displaySamplesFlag"))
            this.displaySamplesFlag = Parameters.getBoolean("displaySamplesFlag");
        if (Parameters.has("displayMosiacFlag"))
            this.displayMosiacFlag = Parameters.getBoolean("displayMosiacFlag");
        if (Parameters.has("mosiacOverlayFlag")) {
            this.mosaicOverlayFlag = Parameters.getBoolean("mosiacOverlayFlag");
            this.mosaicRandomFlag = !(this.mosaicOverlayFlag);
        }
        if (Parameters.has("displayMaskFlag"))
            this.displayMaskFlag = Parameters.getBoolean("displayMaskFlag");
        if (Parameters.has("testMaskOnly"))
            this.testMaskOnly = Parameters.getBoolean("testMaskOnly");
        if (Parameters.has("limitMaskStarsPercent"))
            this.limitMaskStarsPercent = Parameters.getInteger("limitMaskStarsPercent");
        if (Parameters.has("multiplyStarRadius"))
            this.radiusMult = Parameters.getReal("multiplyStarRadius");
        if (Parameters.has("addStarRadius"))
            this.radiusAdd = Parameters.getReal("addStarRadius");
        if (Parameters.has("targetView")) {
            let viewId = Parameters.getString("targetView");
            this.targetView = View.viewById(viewId)
        }
        if (Parameters.has("referenceView")) {
            let viewId = Parameters.getString("referenceView");
            this.referenceView = View.viewById(viewId)
        }

        if (Parameters.has("hasAreaOfInterest"))
            this.hasAreaOfInterest = Parameters.getBoolean("hasAreaOfInterest");
        if (Parameters.has("areaOfInterest_X0")){
            this.areaOfInterest_X0 = Parameters.getInteger("areaOfInterest_X0");
        }
        if (Parameters.has("areaOfInterest_Y0")){
            this.areaOfInterest_Y0 = Parameters.getInteger("areaOfInterest_Y0");
        }
        if (Parameters.has("areaOfInterest_X1")){
            this.areaOfInterest_X1 = Parameters.getInteger("areaOfInterest_X1");
        }
        if (Parameters.has("areaOfInterest_Y1")){
            this.areaOfInterest_Y1 = Parameters.getInteger("areaOfInterest_Y1");
        }
    };

    // Initialise the scripts data
    this.setParameters = function () {
        this.logStarDetection = -0.5;
        this.displayStarsFlag = false;
        this.photometryGraphFlag = true;
        this.orientation = AUTO();
        this.rejectHigh = 0.8;
        this.sampleSize = 20;
        this.limitSampleStarsPercent = 20;
        this.nLineSegments = 35;
        this.displayGradientFlag = false;
        this.displayGraphFlag = true;
        this.displaySamplesFlag = true;
        this.displayMosiacFlag = true;
        this.mosaicOverlayFlag = false;
        this.mosaicRandomFlag = true;
        this.displayMaskFlag = true;
        this.testMaskOnly = false;
        this.limitMaskStarsPercent = 20;
        this.radiusMult = 2.5;
        this.radiusAdd = -1;

        this.hasAreaOfInterest = false;
        this.areaOfInterest_X0 = 0;
        this.areaOfInterest_Y0 = 0;
        this.areaOfInterest_X1 = 0;
        this.areaOfInterest_Y1 = 0;
        
    };

    // Used when the user presses the reset button
    this.resetParameters = function (linearFitDialog) {
        this.setParameters();
        linearFitDialog.orientationCombo.currentItem = AUTO();
        linearFitDialog.starDetectionControl.setValue(this.logStarDetection);
        linearFitDialog.displayStarsControl.checked = this.displayStarsFlag;
        linearFitDialog.photometryGraphControl.checked = this.photometryGraphFlag;
        linearFitDialog.displayGradientControl.checked = this.displayGradientFlag;
        linearFitDialog.displayGraphControl.checked = this.displayGraphFlag;
        linearFitDialog.displaySampleControl.checked = this.displaySamplesFlag;
        linearFitDialog.rejectHigh_Control.setValue(this.rejectHigh);
        linearFitDialog.sampleSize_Control.setValue(this.sampleSize);
        linearFitDialog.limitSampleStarsPercent_Control.setValue(this.limitSampleStarsPercent);
        linearFitDialog.lineSegments_Control.setValue(this.nLineSegments);
        linearFitDialog.displayMosaicControl.checked = this.displayMosiacFlag;
        linearFitDialog.mosaicOverlayControl.checked = this.mosaicOverlayFlag;
        linearFitDialog.starMaskFlagControl.checked = this.displayMaskFlag;
        linearFitDialog.testMaskFlagControl.checked = this.testMaskOnly;
        linearFitDialog.LimitMaskStars_Control.setValue(this.limitMaskStarsPercent);
        linearFitDialog.StarRadiusMultiply_Control.setValue(this.radiusMult);
        linearFitDialog.StarRadiusAdd_Control.setValue(this.radiusAdd);
        
        linearFitDialog.areaOfInterestCheckBox.checked = this.hasAreaOfInterest;
        linearFitDialog.rectangleX0_Control.setValue(this.areaOfInterest_X0);
        linearFitDialog.rectangleY0_Control.setValue(this.areaOfInterest_Y0);
        linearFitDialog.rectangleX1_Control.setValue(this.areaOfInterest_X1);
        linearFitDialog.rectangleY1_Control.setValue(this.areaOfInterest_Y1);
    };

    let activeWindow = ImageWindow.activeWindow;
    this.referenceView = getDefaultReferenceView(activeWindow);
    if (!activeWindow.isNull) {
        this.targetView = activeWindow.currentView;
    }
    // Initialise the script's data
    this.setParameters();
}

function setTargetPreview(previewImage_ViewList, data, targetView){
    let previews = targetView.window.previews;
    if (previews.length > 0) {
        previewImage_ViewList.currentView = previews[0];
        data.preview = previews[0];
    }
}

// The main dialog function
function PhotometricMosaicDialog(data) {
    this.__base__ = Dialog;
    this.__base__();

    // Create the Program Discription at the top
    let titleLabel = createTitleLabel("<b>" + TITLE() + " v" + VERSION() +
            "</b> &mdash; Calculates the scale and offset gradient between two images over their overlapping area.");

    //-------------------------------------------------------
    // Create the reference image field
    //-------------------------------------------------------
    let labelWidth1 = this.font.width("Reference View:");
    let referenceImage_Label = new Label(this);
    referenceImage_Label.text = "Reference View:";
    referenceImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    referenceImage_Label.minWidth = labelWidth1;

    this.referenceImage_ViewList = new ViewList(this);
    this.referenceImage_ViewList.getMainViews();
    this.referenceImage_ViewList.minWidth = 300;
    this.referenceImage_ViewList.currentView = data.referenceView;
    this.referenceImage_ViewList.toolTip = "<p>Select an image to generate a PSF for</p>";
    this.referenceImage_ViewList.onViewSelected = function (view) {
        data.referenceView = view;
    };

    let referenceImage_Sizer = new HorizontalSizer;
    referenceImage_Sizer.spacing = 4;
    referenceImage_Sizer.add(referenceImage_Label);
    referenceImage_Sizer.add(this.referenceImage_ViewList, 100);

    //-------------------------------------------------------
    // Create the target image field
    //-------------------------------------------------------
    let targetImage_Label = new Label(this);
    targetImage_Label.text = "Target View:";
    targetImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    targetImage_Label.minWidth = labelWidth1;

    this.targetImage_ViewList = new ViewList(this);
    this.targetImage_ViewList.getMainViews();
    this.targetImage_ViewList.minWidth = 300;
    this.targetImage_ViewList.currentView = data.targetView;
    this.targetImage_ViewList.toolTip = "<p>Select an image to generate a PSF for</p>";
    this.targetImage_ViewList.onViewSelected = function (view) {
        data.targetView = view;
    };

    let targetImage_Sizer = new HorizontalSizer;
    targetImage_Sizer.spacing = 4;
    targetImage_Sizer.add(targetImage_Label);
    targetImage_Sizer.add(this.targetImage_ViewList, 100);

    let labelSize = this.font.width("Line Segments:");
    //----------------------------------------------------
    // Star detection group box
    //----------------------------------------------------
    this.starDetectionControl = new NumericControl(this);
    this.starDetectionControl.real = true;
    this.starDetectionControl.label.text = "Star Detection:";
    this.starDetectionControl.label.minWidth = labelSize;
    this.starDetectionControl.toolTip = "<p>Smaller values detect more stars.</p>";
    this.starDetectionControl.onValueUpdated = function (value) {
        data.logStarDetection = value;
    };
    this.starDetectionControl.setRange(-3, 3);
    this.starDetectionControl.slider.setRange(0, 600);
    this.starDetectionControl.setPrecision(2);
    this.starDetectionControl.slider.minWidth = 200;
    this.starDetectionControl.setValue(data.logStarDetection);
    
    let starDetectionSizer = new HorizontalSizer;
    starDetectionSizer.spacing = 4;
    starDetectionSizer.add(this.starDetectionControl);
    starDetectionSizer.addStretch();

    let starDetectionGroupBox = createGroupBox(this, "Star Detection");
    starDetectionGroupBox.sizer.add(starDetectionSizer);
    //----------------------------------------------------
    // photometry group box
    //----------------------------------------------------
    this.rejectHigh_Control = new NumericControl(this);
    this.rejectHigh_Control.real = true;
    this.rejectHigh_Control.label.text = "Linear Range:";
    this.rejectHigh_Control.label.minWidth = labelSize;
    this.rejectHigh_Control.toolTip = "<p>Only use pixels within CCD's linear range.</p>";
    this.rejectHigh_Control.onValueUpdated = function (value) {
        data.rejectHigh = value;
    };
    this.rejectHigh_Control.setRange(0.3, 1.0);
    this.rejectHigh_Control.slider.setRange(0, 500);
    this.rejectHigh_Control.setPrecision(2);
    this.rejectHigh_Control.slider.minWidth = 206;
    this.rejectHigh_Control.setValue(data.rejectHigh);

    this.photometryGraphControl = new CheckBox(this);
    this.photometryGraphControl.text = "Photometry Graph";
    this.photometryGraphControl.toolTip = "Graph comparing star flux and their least squares fit line";
    this.photometryGraphControl.checked = data.photometryGraphFlag;
    this.photometryGraphControl.onClick = function (checked) {
        data.photometryGraphFlag = checked;
    };

    this.displayStarsControl = new CheckBox(this);
    this.displayStarsControl.text = "Photometry Stars";
    this.displayStarsControl.toolTip = "Creates mask which indicates stars used for photometry.";
    this.displayStarsControl.checked = data.displayStarsFlag;
    this.displayStarsControl.onClick = function (checked) {
        data.displayStarsFlag = checked;
    };

    let photometrySizer = new HorizontalSizer;
    photometrySizer.spacing = 4;
    photometrySizer.add(this.rejectHigh_Control);
    photometrySizer.addSpacing(10);
    photometrySizer.add(this.photometryGraphControl);
    photometrySizer.addSpacing(10);
    photometrySizer.add(this.displayStarsControl);
    photometrySizer.addStretch();

    let photometryGroupBox = createGroupBox(this, "Photometric Scale");
    photometryGroupBox.sizer.add(photometrySizer);

    //-------------------------------------------------------
    // Gradient detection group box
    //-------------------------------------------------------
    let directionLabel = new Label(this);
    directionLabel.text = "Direction:";
    directionLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    directionLabel.minWidth = labelSize;

    this.orientationCombo = new ComboBox(this);
    this.orientationCombo.editEnabled = false;
    this.orientationCombo.toolTip = "<p>Set to the orientation of the line of intersection between the reference and target frames</p>";
    this.orientationCombo.minWidth = this.font.width("Horizontal");
    this.orientationCombo.addItem("Horizontal");
    this.orientationCombo.addItem("Vertical");
    this.orientationCombo.addItem("Auto");
    this.orientationCombo.currentItem = data.orientation;
    this.orientationCombo.onItemSelected = function () {
        data.orientation = this.currentItem;
    };

    this.displayGradientControl = new CheckBox(this);
    this.displayGradientControl.text = "Create Gradient";
    this.displayGradientControl.toolTip = "Display the background model";
    this.displayGradientControl.checked = data.displayGradientFlag;
    this.displayGradientControl.onClick = function (checked) {
        data.displayGradientFlag = checked;
    };
    this.displayGraphControl = new CheckBox(this);
    this.displayGraphControl.text = "Gradient Graph";
    this.displayGraphControl.toolTip = "Graph displays difference between the two images along the join";
    this.displayGraphControl.checked = data.displayGraphFlag;
    this.displayGraphControl.onClick = function (checked) {
        data.displayGraphFlag = checked;
    };
    this.displaySampleControl = new CheckBox(this);
    this.displaySampleControl.text = "Display Samples";
    this.displaySampleControl.toolTip = "Display the sample squares";
    this.displaySampleControl.checked = data.displaySamplesFlag;
    this.displaySampleControl.onClick = function (checked) {
        data.displaySamplesFlag = checked;
    };

    let orientationSizer = new HorizontalSizer;
    orientationSizer.spacing = 4;
    orientationSizer.add(directionLabel);
    orientationSizer.add(this.orientationCombo);
    orientationSizer.addSpacing(10);
    orientationSizer.add(this.displayGraphControl);
    orientationSizer.addSpacing(10);
    orientationSizer.add(this.displaySampleControl);
    orientationSizer.addSpacing(10);
    orientationSizer.add(this.displayGradientControl);
    orientationSizer.addStretch();

    this.sampleSize_Control = new NumericControl(this);
    this.sampleSize_Control.real = true;
    this.sampleSize_Control.label.text = "Sample Size:";
    this.sampleSize_Control.label.minWidth = labelSize;
    this.sampleSize_Control.toolTip = "<p>Sample binning size. Set between 1 and 3 times bright star diameter. Example: if star diameter = 10 then 30 would work well.</p>";
    this.sampleSize_Control.onValueUpdated = function (value) {
        data.sampleSize = value;
    };
    this.sampleSize_Control.setRange(3, 50);
    this.sampleSize_Control.slider.setRange(3, 50);
    this.sampleSize_Control.setPrecision(0);
    this.sampleSize_Control.slider.minWidth = 200;
    this.sampleSize_Control.setValue(data.sampleSize);

    this.limitSampleStarsPercent_Control = new NumericControl(this);
    this.limitSampleStarsPercent_Control.real = true;
    this.limitSampleStarsPercent_Control.label.text = "Limit Stars %:";
    this.limitSampleStarsPercent_Control.label.minWidth = labelSize;
    this.limitSampleStarsPercent_Control.toolTip = "<p>Reduce to increase number of sample points.</p>";
    this.limitSampleStarsPercent_Control.onValueUpdated = function (value) {
        data.limitSampleStarsPercent = value;
    };
    this.limitSampleStarsPercent_Control.setRange(0, 100);
    this.limitSampleStarsPercent_Control.slider.setRange(0, 100);
    this.limitSampleStarsPercent_Control.setPrecision(0);
    this.limitSampleStarsPercent_Control.slider.minWidth = 200;
    this.limitSampleStarsPercent_Control.setValue(data.limitSampleStarsPercent);

    this.lineSegments_Control = new NumericControl(this);
    this.lineSegments_Control.real = true;
    this.lineSegments_Control.label.text = "Line Segments:";
    this.lineSegments_Control.label.minWidth = labelSize;
    this.lineSegments_Control.toolTip = "<p>The number of lines used to fit the data.</p>";
    this.lineSegments_Control.onValueUpdated = function (value) {
        data.nLineSegments = value;
    };
    this.lineSegments_Control.setRange(1, 49);
    this.lineSegments_Control.slider.setRange(1, 25);
    this.lineSegments_Control.setPrecision(0);
    this.lineSegments_Control.slider.minWidth = 200;
    this.lineSegments_Control.setValue(data.nLineSegments);

    let gradientGroupBox = createGroupBox(this, "Gradient Offset");
    gradientGroupBox.sizer.add(orientationSizer);
    gradientGroupBox.sizer.add(this.sampleSize_Control);
    gradientGroupBox.sizer.add(this.limitSampleStarsPercent_Control);
    gradientGroupBox.sizer.add(this.lineSegments_Control);

    //-------------------------------------------------------
    // Mosaic Group Box
    //-------------------------------------------------------
    let mosaic_Label = new Label(this);
    mosaic_Label.text = "Mosaic:";
    mosaic_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    mosaic_Label.minWidth = this.font.width(mosaic_Label.text);

    this.displayMosaicControl = new CheckBox(this);
    this.displayMosaicControl.text = "Create Mosaic";
    this.displayMosaicControl.toolTip = "Adds reference & target frames and displays in a 'MosaicTest' window";
    this.displayMosaicControl.checked = data.displayMosiacFlag;
    this.displayMosaicControl.onClick = function (checked) {
        data.displayMosiacFlag = checked;
    };

    this.mosaicOverlayControl = new RadioButton(this);
    this.mosaicOverlayControl.text = "Overlay";
    this.mosaicOverlayControl.toolTip = "Overlays reference image on top of the target image";
    this.mosaicOverlayControl.checked = data.mosaicOverlayFlag;
    this.mosaicOverlayControl.onClick = function (checked) {
        data.mosaicOverlayFlag = checked;
        data.mosaicRandomFlag = !checked;
    };

    this.mosaicRandomControl = new RadioButton(this);
    this.mosaicRandomControl.text = "Random";
    this.mosaicRandomControl.toolTip = "Randomly choose pixels from the reference and target image";
    this.mosaicRandomControl.checked = data.mosaicRandomFlag;
    this.mosaicRandomControl.onClick = function (checked) {
        data.mosaicRandomFlag = checked;
        data.mosaicOverlayFlag = !checked;
    };

    let mosaic_Sizer = new HorizontalSizer;
    mosaic_Sizer.spacing = 4;
    mosaic_Sizer.add(mosaic_Label);
    mosaic_Sizer.add(this.displayMosaicControl);
    mosaic_Sizer.addSpacing(20);
    mosaic_Sizer.add(this.mosaicOverlayControl);
    mosaic_Sizer.add(this.mosaicRandomControl);
    mosaic_Sizer.addStretch();

    let mosaicGroupBox = createGroupBox(this, "Mosaic");
    mosaicGroupBox.sizer.add(mosaic_Sizer);
    
    //-------------------------------------------------------
    // Mask Generation Group Box
    //-------------------------------------------------------
    this.starMaskFlagControl = new CheckBox(this);
    this.starMaskFlagControl.text = "Create Star Mask";
    this.starMaskFlagControl.toolTip = "Create a star mask to help fix ragged star edges after 'Random' join";
    this.starMaskFlagControl.checked = data.displayMaskFlag;
    this.starMaskFlagControl.onClick = function (checked) {
        data.displayMaskFlag = checked;
    };
    
    this.testMaskFlagControl = new CheckBox(this);
    this.testMaskFlagControl.text = "Test Mask";
    this.testMaskFlagControl.toolTip = "Only create a star mask";
    this.testMaskFlagControl.checked = data.testMaskOnly;
    this.testMaskFlagControl.onClick = function (checked) {
        data.testMaskOnly = checked;
    };
    
    let mask_Sizer = new HorizontalSizer;
    mask_Sizer.spacing = 4;
    mask_Sizer.add(this.starMaskFlagControl);
    mask_Sizer.addSpacing(20);
    mask_Sizer.add(this.testMaskFlagControl);
    mask_Sizer.addStretch();
    
    let starMaskLabelSize = this.font.width("Multiply Star Radius:");
    this.LimitMaskStars_Control = new NumericControl(this);
//    this.LimitMaskStars_Control.real = true;
    this.LimitMaskStars_Control.label.text = "Limit Stars %:";
    this.LimitMaskStars_Control.toolTip = "<p>Increase to include more faint stars.</p>";
    this.LimitMaskStars_Control.label.setFixedWidth(starMaskLabelSize);
    this.LimitMaskStars_Control.setRange(0, 100);
    this.LimitMaskStars_Control.slider.setRange(0, 100);
    this.LimitMaskStars_Control.setPrecision(0);
    this.LimitMaskStars_Control.slider.minWidth = 200;
    this.LimitMaskStars_Control.setValue(data.limitMaskStarsPercent);
    this.LimitMaskStars_Control.onValueUpdated = function (value) {
        data.limitMaskStarsPercent = value;
    };
    
    this.StarRadiusMultiply_Control = new NumericControl(this);
    this.StarRadiusMultiply_Control.real = true;
    this.StarRadiusMultiply_Control.label.text = "Multiply Star Radius:";
    this.StarRadiusMultiply_Control.toolTip = "<p>Multiply star's radius.</p>";
    this.StarRadiusMultiply_Control.setRange(1, 5);
    this.StarRadiusMultiply_Control.slider.setRange(1, 150);
    this.StarRadiusMultiply_Control.setPrecision(1);
    this.StarRadiusMultiply_Control.slider.minWidth = 150;
    this.StarRadiusMultiply_Control.setValue(data.radiusMult);
    this.StarRadiusMultiply_Control.onValueUpdated = function (value) {
        data.radiusMult = value;
    };
    
    this.StarRadiusAdd_Control = new NumericControl(this);
    this.StarRadiusAdd_Control.real = true;
    this.StarRadiusAdd_Control.label.text = "Add to Star Radius:";
    this.StarRadiusAdd_Control.toolTip = "<p>Add to star's radius.</p>";
    this.StarRadiusAdd_Control.setRange(-5, 10);
    this.StarRadiusAdd_Control.slider.setRange(0, 150);
    this.StarRadiusAdd_Control.setPrecision(1);
    this.StarRadiusAdd_Control.slider.minWidth = 150;
    this.StarRadiusAdd_Control.setValue(data.radiusAdd);
    this.StarRadiusAdd_Control.onValueUpdated = function (value) {
        data.radiusAdd = value;
    };
    
    let radiusHorizontalSizer = new HorizontalSizer;
    radiusHorizontalSizer.spacing = 20;
    radiusHorizontalSizer.add(this.StarRadiusMultiply_Control);
    radiusHorizontalSizer.add(this.StarRadiusAdd_Control);
    //radiusHorizontalSizer.addStretch();

    let starMaskGroupBox = createGroupBox(this, "Star Mask");
    starMaskGroupBox.sizer.add(mask_Sizer);
    starMaskGroupBox.sizer.add(this.LimitMaskStars_Control);
    starMaskGroupBox.sizer.add(radiusHorizontalSizer);

    //-------------------------------------------------------
    // Area of interest
    //-------------------------------------------------------
    let labelWidth2 = this.font.width("Height:_");

    this.rectangleX0_Control = createNumericEdit("Left:", "Top left of rectangle X-Coordinate.", data.areaOfInterest_X0, labelWidth2, 50);
    this.rectangleX0_Control.onValueUpdated = function (value){
        data.areaOfInterest_X0 = value;
    };
    this.rectangleY0_Control = createNumericEdit("Top:", "Top left of rectangle Y-Coordinate.", data.areaOfInterest_Y0, labelWidth2, 50);
    this.rectangleY0_Control.onValueUpdated = function (value){
        data.areaOfInterest_Y0 = value;
    };
    this.rectangleX1_Control = createNumericEdit("Right:", "Bottom right of rectangle X-Coordinate.", data.areaOfInterest_X1, labelWidth2, 50);
    this.rectangleX1_Control.onValueUpdated = function (value){
        data.areaOfInterest_X1 = value;
    };
    this.rectangleY1_Control = createNumericEdit("Bottom:", "Bottom right of rectangle Y-Coordinate.", data.areaOfInterest_Y1, labelWidth2, 50);
    this.rectangleY1_Control.onValueUpdated = function (value){
        data.areaOfInterest_Y1 = value;
    };

    this.areaOfInterestCheckBox = new CheckBox(this);
    this.areaOfInterestCheckBox.text = "Area of Interest";
    this.areaOfInterestCheckBox.toolTip = "Limit samples to area of interest";
    this.areaOfInterestCheckBox.checked = data.hasAreaOfInterest;
    this.areaOfInterestCheckBox.onClick = function (checked) {
        data.hasAreaOfInterest = checked;
    };

    let coordHorizontalSizer = new HorizontalSizer;
    coordHorizontalSizer.spacing = 10;
    coordHorizontalSizer.add(this.areaOfInterestCheckBox);
    coordHorizontalSizer.addSpacing(20);
    coordHorizontalSizer.add(this.rectangleX0_Control);
    coordHorizontalSizer.add(this.rectangleY0_Control);
    coordHorizontalSizer.add(this.rectangleX1_Control);
    coordHorizontalSizer.add(this.rectangleY1_Control);
    coordHorizontalSizer.addStretch();

    // Area of interest Target->preview
    let previewImage_Label = new Label(this);
    previewImage_Label.text = "Get area from preview:";
    previewImage_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;

    this.previewImage_ViewList = new ViewList(this);
    this.previewImage_ViewList.getPreviews();
    this.previewImage_ViewList.minWidth = 300;
    this.previewImage_ViewList.toolTip = "<p>Get area of interest from preview image.</p>";
    this.previewImage_ViewList.onViewSelected = function (view) {
        data.preview = view;
    };
    setTargetPreview(this.previewImage_ViewList, data, data.targetView);

    let previewUpdateButton = new PushButton();
    previewUpdateButton.hasFocus = false;
    previewUpdateButton.text = "Update";
    previewUpdateButton.onClick = function () {
        if (!this.isUnderMouse){
            // Ensure pressing return in a different field does not trigger this callback!
            return;
        }
        let view = data.preview;
        if (view.isPreview) {
            data.hasAreaOfInterest = true;
            this.dialog.areaOfInterestCheckBox.checked = data.hasAreaOfInterest;
            ///let imageWindow = view.window;
            let rect = view.window.previewRect(view);
            data.areaOfInterest_X0 = rect.x0;
            data.areaOfInterest_Y0 = rect.y0;
            data.areaOfInterest_X1 = rect.x1;
            data.areaOfInterest_Y1 = rect.y1;

            this.dialog.rectangleX0_Control.setValue(data.areaOfInterest_X0);
            this.dialog.rectangleY0_Control.setValue(data.areaOfInterest_Y0);
            this.dialog.rectangleX1_Control.setValue(data.areaOfInterest_X1);
            this.dialog.rectangleY1_Control.setValue(data.areaOfInterest_Y1);
        }
    };

    let previewImage_Sizer = new HorizontalSizer;
    previewImage_Sizer.spacing = 4;
    previewImage_Sizer.add(previewImage_Label);
    previewImage_Sizer.add(this.previewImage_ViewList, 100);
    previewImage_Sizer.addSpacing(10);
    previewImage_Sizer.add(previewUpdateButton);

    let areaOfInterest_GroupBox = createGroupBox(this, "Area of Interest");
    areaOfInterest_GroupBox.sizer.add(coordHorizontalSizer, 10);
    areaOfInterest_GroupBox.sizer.add(previewImage_Sizer);

    const helpWindowTitle = TITLE() + " v" + VERSION();
    const HELP_MSG =
            "<p>Apply a gradient to the target image so that it matches the reference image. The default parameters should work well. " +
            "Adjust the 'Sample Size' if your images are over or under sampled.</p>" +
            "<p>The 'CCD Linear Range' rejects all sample squares that contain a sample above this level. " +
            "This ensures that only the linear part of the CCD's range is used.</p>" +
            "<p>The images are divided into 'Sample Size' squares; a sample is the average of a square. " +
            "The 'Sample Size' should be bigger than the diameter of bright stars. " +
            "If set too small, differing FWHM between the two images will affect the linear fit.</p>";

    let buttons_Sizer = createWindowControlButtons(this.dialog, data, helpWindowTitle, HELP_MSG);

    //-------------------------------------------------------
    // Vertically stack all the objects
    //-------------------------------------------------------
    this.sizer = new VerticalSizer;
    this.sizer.margin = 6;
    this.sizer.spacing = 4;
    this.sizer.add(titleLabel);
//    this.sizer.addSpacing(4);
    this.sizer.add(referenceImage_Sizer);
    this.sizer.add(targetImage_Sizer);
    this.sizer.add(starDetectionGroupBox);
    this.sizer.add(photometryGroupBox);
    this.sizer.add(gradientGroupBox);
    this.sizer.add(areaOfInterest_GroupBox);
    this.sizer.add(mosaicGroupBox);
    this.sizer.add(starMaskGroupBox);
    this.sizer.add(buttons_Sizer);

    //-------------------------------------------------------
    // Set all the window data
    //-------------------------------------------------------
    this.windowTitle = TITLE();
    this.adjustToContents();
    this.setFixedSize();
}

// Our dialog inherits all properties and methods from the core Dialog object.
PhotometricMosaicDialog.prototype = new Dialog;

// Photometric Mosaic main process
function main() {
//    testLeastSquareFitAlgorithm();
    
    if (ImageWindow.openWindows.length < 2) {
        (new MessageBox("ERROR: there must be at least two images open for this script to function", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
        return;
    }

    // Create dialog, start looping
    let data = new PhotometricMosaicData();

    if (Parameters.isGlobalTarget || Parameters.isViewTarget) {
        data.loadParameters();
    }

    let linearFitDialog = new PhotometricMosaicDialog(data);
    for (; ; ) {
        if (!linearFitDialog.execute())
            break;
        console.show();
        console.writeln("=================================================");
        console.writeln("<b>" + TITLE() + " ", VERSION(), "</b>:");

        // User must select a reference and target view with the same dimensions and color depth
        if (data.targetView.isNull) {
            (new MessageBox("WARNING: Target view must be selected", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.referenceView.isNull) {
            (new MessageBox("WARNING: Reference view must be selected", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.targetView.image.isColor !== data.referenceView.image.isColor) {
            (new MessageBox("ERROR: Cannot linear fit a B&W image with a colour image", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.targetView.image.width !== data.referenceView.image.width ||
                data.targetView.image.height !== data.referenceView.image.height) {
            (new MessageBox("ERROR: Both images must have the same dimensions", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }
        if (data.targetView.fullId === data.referenceView.fullId ||
                data.targetView.image.height !== data.referenceView.image.height) {
            (new MessageBox("ERROR: Target and  Reference are set to the same view", TITLE(), StdIcon_Error, StdButton_Ok)).execute();
            continue;
        }

        // Calculate and apply the linear fit
        PhotometricMosaic(data);
        console.hide();

        // Quit after successful execution.
        //break;
    }

    return;
}

main();
