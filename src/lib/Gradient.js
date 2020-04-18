/* global UndoFlag_NoSwapFile */

// Version 1.0 (c) John Murphy 17th-Mar-2020
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
 * @param {Number[]} difArray
 * @param {Number} minLineValue
 * @param {Number} maxLineValue
 * @returns {GradientData}
 */
function GradientData(difArray, minLineValue, maxLineValue){
    this.difArray = difArray;
    this.minLineValue = minLineValue;
    this.maxLineValue = maxLineValue;
}

/**
 * Calculates the offset gradient between the reference and target samples.
 * Represents the gradient in a single channel. (use 3 instances  for color images.)
 * @param {SamplePairs} samplePairs Contains SamplePairArray and their bounding box.
 * @param {Number} nSections The number of least square fit lines to calculate.
 * @param {Image} targetImage Used to get image width and height
 * @param {Rect} overlapBox Overlap bounding box
 * @param {Boolean} isHorizontal True if the mosaic join is a horizontal strip
 * @returns {Gradient}
 */
function Gradient(samplePairs, nSections, targetImage, overlapBox, isHorizontal){
    this.isValid = true;
    let self = this;
    /**
     * Split the sample coverage area into sections and calculate the gradient linear fit
     * for each section.
     * Returns an array of all the sections.
     * @param {SamplePairs} samplePairs Contains the SamplePairArray and their bounding box.
     * @param {Boolean} isHorizontal True if the mosaic join is a horizontal strip
     * @returns {SampleSection[]} Each entry contains the calculated best fit gradient line
     */
    let getSampleSections = function (samplePairs, isHorizontal){
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
            self.isValid = newSampleSection.calcLinearFit(samplePairs);
            if (!self.isValid){
                // Not enough samples in a section to calculate the line
                return [];
            }
            sections[i] = newSampleSection;
        }
        return sections;
    };
    
    /**
     * Join section lines together by adding dummy SampleSection between each genuine one.
     * The boundaries of the existing SampleSection's are adjusted to make room.
     * The new SampleSection contains a line that 'cuts the corner' between
     * where the original lines ended.
     * This is essential because the original lines might not even intersect.
     * @param {SampleSection[]} sampleSections
     * @returns {SampleSection[]}
     */
    let joinSectionLines = function(sampleSections){
        if (sampleSections.length > 1) {
            // Calculate how far to move the existing SampleSection boundaries.
            // The newly inserted SampleSection will be (dist * 2) wide.
            let s = sampleSections[1];
            let dist = Math.round((s.maxCoord - s.minCoord) / 6);
            if (dist < 2) {
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
    };
    
    /**
     * How the difference lines are calculated:
     * (1) The SampleArea is the bounding rectangle of all the SamplePairs.
     * (2) The overlapBox is the bounding box of the overlap region. The SampleArea
     * is a subset of the overlapBox (it can be the same size, but not bigger.)
     * (3) The SampleArea is divided into SampleSection. Each of these sections
     * defines a gradient line. The dif value within the sample area is calculated
     * from the equation of this line: dif = mx + b
     * (4) From the start of the image to the start of the overlapBox, the dif value
     * is held constant.
     * (5) From the start of the overlapBox to the first SampleSection, 
     * the line from that first SampleSection is extended.
     * (6) From the last SampleSection to the end of the overlapBox 
     * the line from that last SampleSection is extended.
     * (7) From the end of the overlapBox to the end of the image, the dif value
     * is held constant.
     * @param {SampleSection[]} sections Calculate best fit line for each SampleSection
     * @param {Rect} overlapBox overlap bounding box
     * @param {Image} targetImage Used to get image width / height
     * @param {Boolean} isHorizontal True if the overlap strip is horizontal
     * @returns {EquationOfLine[]}
     */
    let createGradientLines = function(sections, overlapBox, targetImage, isHorizontal){
        let overlapMin;
        let overlapMax;
        let imageMax;
        if (isHorizontal) {
            overlapMin = overlapBox.x0;
            overlapMax = overlapBox.x1;
            imageMax = targetImage.width;
        } else {
            overlapMin = overlapBox.y0;
            overlapMax = overlapBox.y1;
            imageMax = targetImage.height;
        }

        let eqnOfLines = [];
        if (overlapMin > 0){
            // First horizontal line to start of overlap
            // The first line is horizontal (gradient = 0)
            // and intersects the first section line at overlapMin
            let linearFitData = sections[0].linearFitData;
            let b = eqnOfLineCalcY(overlapMin, linearFitData.m, linearFitData.b);
            eqnOfLines.push(new EquationOfLine(0, b, 0, overlapMin));
        }

        // Each section
        for (let i = 0; i < sections.length; i++){
            let x0 = (i===0 ? overlapMin : sections[i].minCoord);
            let x1 = (i===sections.length - 1 ? overlapMax : sections[i].maxCoord);
            let m = sections[i].linearFitData.m;
            let b = sections[i].linearFitData.b;
            eqnOfLines.push(new EquationOfLine(m, b, x0, x1));
        }

        // From end of sections to end of image
        if (overlapMax < imageMax){
            // The last line is horizontal (gradient = 0)
            // and intersects the last section line at overlapMax
            let linearFitData = sections[sections.length-1].linearFitData;
            let b = eqnOfLineCalcY(overlapMax, linearFitData.m, linearFitData.b);
            eqnOfLines.push(new EquationOfLine(0, b, overlapMax, imageMax));
        }

        return eqnOfLines;    
    };
    
    /**
     * Create the gradient as an array of pixel differences, stored in the GradientData structure.
     *
     * @param {EquationOfLine[]} eqnLines EquationOfLine array
     * @returns {GradientData}
     */
    let createGradient = function(eqnLines) {
        let minLineValue = Number.POSITIVE_INFINITY;
        let maxLineValue = Number.NEGATIVE_INFINITY;

        let difArray = [];
        for (let eqnLine of eqnLines){
            minLineValue = Math.min(minLineValue, eqnLine.y0);
            maxLineValue = Math.max(maxLineValue, eqnLine.y0);
            for (let x = eqnLine.x0; x < eqnLine.x1; x++){
                difArray.push(eqnLine.calcYFromX(x));
            }
        }

        let eqnLine = eqnLines[eqnLines.length - 1];
        minLineValue = Math.min(minLineValue, eqnLine.y1);
        maxLineValue = Math.max(maxLineValue, eqnLine.y1);

        if (difArray.length !== eqnLines[eqnLines.length-1].x1) {
            console.criticalln("Error: DifArray length = " + difArray.length + "image size = " + eqnLines[eqnLines.length-1].x1);
        }
        return new GradientData(difArray, minLineValue, maxLineValue);
    };
    
    /**
     * @returns {EquationOfLine[]}
     */
    this.getGradientLines = function (){
        return this.eqnLineArray;
    };
    
    /**
     * @returns {GradientData}
     */
    this.getGradientData = function(){
        return this.gradientData;
    };
    
    let sampleSections = getSampleSections(samplePairs, isHorizontal);
    if (this.isValid){
        sampleSections = joinSectionLines(sampleSections);
        this.eqnLineArray = createGradientLines(sampleSections, overlapBox, targetImage, isHorizontal);
        this.gradientData = createGradient(this.eqnLineArray);
    }
}



/**
 * Represents a single section of the mosaic join.
 * Calculates and stores LinearFitData.
 * Also stores minCoord, maxCoord and isHorizontal flag
 * @param {Number} minCoord Minimum coordinate of section boundary
 * @param {Number} maxCoord Maximum coordinate of section boundary
 * @param {Boolean} isHorizontal
 * @returns {SampleSection}
 */
function SampleSection(minCoord, maxCoord, isHorizontal){
    this.linearFitData = null;
    this.minCoord = minCoord;
    this.maxCoord = maxCoord;
    this.isHorizontal = isHorizontal;

    /**
     * Determine which SamplePair are within this section's area, and uses
     * them to calculate their best linear fit
     * @param {SamplePairs} samplePairs Contains samplePairArray
     * @returns {Boolean} True if a valid line could be fitted to the points
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
        if (samplePairArray.length < 2){
            // Unable to fit a line because this section has less than two points
            return false;
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
        
        // If all points in this section were at the same coordinate the gradient will be infinite (invalid)
        return (this.linearFitData.m !== Number.POSITIVE_INFINITY &&
                this.linearFitData.m !== Number.NEGATIVE_INFINITY);
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
 * Calculates the offset in the direction perpendicular to the join.
 * Over the overlap area this is constant.
 * Before and after the overlap area, it tapers towards the average offset.
 * Beyond the taper length, it returns the average offset.
 * @param {Number} imageWidth
 * @param {Number} imageHeight
 * @param {Number} average Average offset (average value in difArray)
 * @param {Rect} overlapBox Bounding box of the overlap between target and reference images
 * @param {Number} taperLength Taper (or feather) length
 * @param {Boolean} isHorizontal Tile join direction
 * @returns {GradientOffset}
 */
function GradientOffset(imageWidth, imageHeight, average, overlapBox, taperLength, isHorizontal) {
    this.average = average;
    this.taperLength = taperLength;
    if (isHorizontal){
        this.limit1 = Math.max(0, overlapBox.y0 - taperLength);
        this.limit2 = overlapBox.y0;
        this.limit3 = overlapBox.y1;
        this.limit4 = Math.min(imageHeight, overlapBox.y1 + taperLength);
    } else {
        this.limit1 = Math.max(0, overlapBox.x0 - taperLength);
        this.limit2 = overlapBox.x0;
        this.limit3 = overlapBox.x1;
        this.limit4 = Math.min(imageWidth, overlapBox.x1 + taperLength);
    }
    
    /**
     * Get the tapered offset value between the reference and target image.
     * Outside the overlap region, it tapers down towards the average offset.
     * @param {Number} coord x-coord (vertical join) or y-coord (horizontal join)
     * @param {Number} dif Value from the difArray
     * @returns {Number} Offset to subtract from target image
     */
    this.getOffset = function(coord, dif){
        if (coord < this.limit1 || coord > this.limit4){
            // First or last region; Only apply average offset
            return this.average;
        }
        if (coord < this.limit2){
            // Progressively apply more of the correction as we approach the overlap 
            let delta = dif - this.average;
            let fraction = 1 - (this.limit2 - coord) / this.taperLength;
            return this.average + delta * fraction;
        }
        if (coord < this.limit3){
            // Overlap region: apply the full correction
            return dif;
        }
        // Progressively apply less of the correction as we move away from the overlap
        let delta = dif - this.average;
        let fraction = 1 - (coord - this.limit3) / this.taperLength;
        return this.average + delta * fraction;
    };
}

/**
 * Calculates maximum and minimum values for the samples and the best fit line(s)
 * @param {SamplePairs[]} colorSamplePairs Contains samplePairArray
 * @param {Gradient[]} gradients This stores the min and max line y values
 * @returns {SamplePairDifMinMax}
 */
function SamplePairDifMinMax(colorSamplePairs, gradients) {
    let gradientData = gradients[0].getGradientData();
    this.minDif = gradientData.minLineValue;
    this.maxDif = gradientData.maxLineValue;
    if (gradients.length === 3){
        let gradientData1 = gradients[1].getGradientData();
        let gradientData2 = gradients[2].getGradientData();
        this.minDif = Math.min(this.minDif, gradientData1.minLineValue, gradientData2.minLineValue);
        this.maxDif = Math.max(this.maxDif, gradientData1.maxLineValue, gradientData2.maxLineValue);
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
 * Display graph of (difference between images) / (pixel distance across image)
 * @param {View} targetView Used for view name
 * @param {View} referenceView Used for view name
 * @param {Number} width Graph width. Limited to target image size (width or height).
 * @param {Boolean} isHorizontal
 * @param {Gradient[]} gradients Contains best fit gradient lines for each channel
 * @param {SamplePairs[]} colorSamplePairs The SamplePair points to be displayed (array contains color channels)
 * @param {PhotometricMosaicData} data User settings used to create FITS header
 * @returns {undefined}
 */
function displayGradientGraph(targetView, referenceView, width, isHorizontal, gradients, colorSamplePairs, data){
    /**
     * @param {View} refView
     * @param {View} tgtView
     * @param {ImageWindow} graphWindow Graph window
     * @param {Gradient[]} gradients Contains best fit lines for each channel
     * @param {PhotometricMosaicData} data User settings used to create FITS header
     * @return {undefined}
     */
    let gradientGraphFitsHeader = function(refView, tgtView, graphWindow, gradients, data){
        let view = graphWindow.mainView;
        let nColors = gradients.length;
        view.beginProcess(UndoFlag_NoSwapFile); // don't add to undo list
        let keywords = graphWindow.keywords;
        keywords.push(new FITSKeyword("COMMENT", "", "Ref: " + refView.fullId));
        keywords.push(new FITSKeyword("COMMENT", "", "Tgt: " + tgtView.fullId));
        keywords.push(new FITSKeyword("COMMENT", "", "StarDetection: " + data.logStarDetection));
        keywords.push(new FITSKeyword("COMMENT", "", "SampleSize: " + data.sampleSize));
        keywords.push(new FITSKeyword("COMMENT", "", "LimitStarsPercent: " + data.limitSampleStarsPercent));
        keywords.push(new FITSKeyword("COMMENT", "", "LineSegments: " + data.nLineSegments));
        if (data.taperFlag){
            keywords.push(new FITSKeyword("COMMENT", "", "TaperLength: " + data.taperLength));
        }
        
        for (let c = 0; c < nColors; c++){
            let eqnLines = gradients[c].getGradientLines();
            for (let i=0; i<eqnLines.length; i++){
                let eqnLine = eqnLines[i];
                let offset = eqnOfLineCalcY(eqnLine.x0, eqnLine.m, eqnLine.b);
                let comment = "Offset[" + c + "] at " + eqnLine.x0 + " = " + offset.toPrecision(5);
                keywords.push(new FITSKeyword("COMMENT", "", comment));
                if (i === eqnLines.length - 1){
                    let offset1 = eqnOfLineCalcY(eqnLine.x1, eqnLine.m, eqnLine.b);
                    let comment2 = "Offset[" + c + "] at " + eqnLine.x1 + " = " + offset1.toPrecision(5);
                    keywords.push(new FITSKeyword("COMMENT", "", comment2));
                }
            }
        }
        graphWindow.keywords = keywords;
        view.endProcess();
    };
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
    let drawLineAndPoints = function(graph, isHorizontal, eqnLines, lineColor, samplePairs, pointColor) {
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
    };
    
    let axisWidth;
    let maxCoordinate;
    let imageWindow = null;
    let windowTitle = WINDOW_ID_PREFIX() + targetView.fullId + "__Gradient";
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
    const minScaleDif = 2e-4;
    let minMax = new SamplePairDifMinMax(colorSamplePairs, gradients);
    let maxY = minMax.maxDif;
    let minY = minMax.minDif;
    if (maxY - minY < minScaleDif){
        maxY += minScaleDif / 2;
        minY -= minScaleDif / 2;
    }
    let graphWithAxis = new Graph(0, minY, maxCoordinate, maxY);
    graphWithAxis.setAxisLength(axisWidth + 2, 720);
    graphWithAxis.createGraph(xLabel, yLabel);

    if (colorSamplePairs.length === 1){ // B&W
        drawLineAndPoints(graphWithAxis, isHorizontal, 
            gradients[0].getGradientLines(), 0xFFFFFFFF,
            colorSamplePairs[0], 0xFFFFFFFF);
        imageWindow = graphWithAxis.createWindow(windowTitle, false);
    } else {
        // Color. Need to create 3 graphs for r, g, b and then merge them (binary OR) so that
        // if three samples are on the same pixel we get white and not the last color drawn
        let lineColors = [0xFFFF0000, 0xFF00FF00, 0xFF0000FF]; // r, g, b
        let pointColors = [0xFFFF0000, 0xFF00FF00, 0xFF0000FF]; // r, g, b
        for (let c = 0; c < colorSamplePairs.length; c++){
            let graphAreaOnly = graphWithAxis.createGraphAreaOnly();
            drawLineAndPoints(graphAreaOnly, isHorizontal, 
                gradients[c].getGradientLines(), lineColors[c],
                colorSamplePairs[c], pointColors[c]);
            graphWithAxis.mergeWithGraphAreaOnly(graphAreaOnly);
        }
        imageWindow = graphWithAxis.createWindow(windowTitle, true);
    }
    gradientGraphFitsHeader(referenceView, targetView, imageWindow, gradients, data);
    imageWindow.show();
}
