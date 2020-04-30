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
 * @param {GradientData} propagatedGradientData If not null, this correction is applied first
 * @returns {Gradient}
 */
function Gradient(samplePairs, nSections, targetImage, overlapBox, isHorizontal, propagatedGradientData){
    this.isValid = true;
    let self = this;
    /**
     * Split the sample coverage area into sections and calculate the gradient linear fit
     * for each section.
     * Returns an array of all the sections.
     * @param {SamplePairs} samplePairs Contains the SamplePairArray and their bounding box.
     * @param {Boolean} isHorizontal True if the mosaic join is a horizontal strip
     * @param {GradientData} propagatedGradientData If not null, this correction is applied first
     * @returns {SampleSection[]} Each entry contains the calculated best fit gradient line
     */
    let getSampleSections = function (samplePairs, isHorizontal, propagatedGradientData){
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
        let difArray = propagatedGradientData !== null ? propagatedGradientData.difArray : null;

        // Split the SamplePair area into sections of equal size.
        let sections = [];
        for (let i=0; i<nSections; i++){
            // ...Coord is x if horizontal join, y if vertical join
            let minCoord = Math.floor(sampleAreaStart + interval * i);
            let maxCoord = Math.floor(sampleAreaStart + interval * (i+1));
            let newSampleSection = new SampleSection(minCoord, maxCoord, isHorizontal);
            self.isValid = newSampleSection.calcLinearFit(samplePairs, difArray);
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
    
    let sampleSections = getSampleSections(samplePairs, isHorizontal, propagatedGradientData);
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
     * @param {Number[]} initialDifArray Propagated gradient difArray, or null
     * @returns {Boolean} True if a valid line could be fitted to the points
     */
    this.calcLinearFit = function (samplePairs, initialDifArray) {
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
        
        samplePairArray.forEach((samplePair) => {
            let coord = isHorizontal ? samplePair.rect.center.x : samplePair.rect.center.y;
            let value = samplePair.targetMedian - samplePair.referenceMedian;
            if (initialDifArray){
                value -= initialDifArray[coord];
            }
            algorithm.addValue(coord, value);
        });
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
 * This class is used to apply the scale and gradient to the target image
 * @param {Number} imageWidth
 * @param {Number} imageHeight
 * @param {Rect} joinRect The specified join area (a subset of the actual overlap)
 * @param {Boolean} taperFlag If true, taper the gradient correction
 * @param {Number} taperLength Taper (or feather) length
 * @param {Boolean} isHorizontal If true, one image is above the other
 * @param {Boolean} isTargetAfterRef True if target image is below or right of reference image
 * @returns {ScaleAndGradientApplier}
 */
function ScaleAndGradientApplier(imageWidth, imageHeight, joinRect, 
        taperFlag, taperLength, isHorizontal, isTargetAfterRef) {
    this.taperFlag = taperFlag;
    this.taperLength = taperLength;
    this.isTargetAfterRef = isTargetAfterRef;
    this.isHorizontal = isHorizontal;
    if (isHorizontal){
        this.firstTaperStart = Math.max(0, joinRect.y0 - taperLength); // joinStart - taperLength
        this.joinStart = joinRect.y0;
        this.joinEnd = joinRect.y1;
        this.secondTaperEnd = Math.min(imageHeight, joinRect.y1 + taperLength); // joinEnd + taperLength
    } else {
        this.firstTaperStart = Math.max(0, joinRect.x0 - taperLength);
        this.joinStart = joinRect.x0;
        this.joinEnd = joinRect.x1;
        this.secondTaperEnd = Math.min(imageWidth, joinRect.x1 + taperLength);
    }
    
    /**
     * Applies the scale and gradient correction to the supplied view.
     * 
     * @param {View} view
     * @param {Number} scale
     * @param {Number[]} propagateDifArray
     * @param {Number[]} taperDifArray
     * @param {Rect} tgtBox Target image bounding box
     * @param {Number} channel
     * @returns {undefined}
     */
    this.applyAllCorrections = function (view, scale, propagateDifArray, taperDifArray, tgtBox, channel){
        processEvents();
        
        if (this.taperFlag) {
            const length = taperDifArray.length;
            let bgDif;
            let fullDif;
            if (propagateDifArray !== null){
                // Apply propagateDifArray + taperDifArray to the join area
                // Apply propagateDifArray + taperDifArray * taperFraction in taper area
                // Apply propagateDifArray outside the join and taper area
                bgDif = propagateDifArray;
                fullDif = [];
                for (let i=0; i<length; i++){
                    fullDif.push(propagateDifArray[i] + taperDifArray[i]);
                }
            } else {
                // Apply taperDifArray to the join area
                // Apply average taperDifArray outside the join and taper area
                let average = Math.mean(taperDifArray);
                //bgDif = Array(length).fill(average);
                bgDif = [];
                for (let i=0; i<length; i++){
                    bgDif.push(average);
                }
                fullDif = taperDifArray;
                console.writeln("Channel[", channel, "] average offset ", average.toPrecision(5));
            }
            
            if (this.isHorizontal) {
                if (this.isTargetAfterRef) {
                    // Full correction from start of target up to end of the join region
                    this.applyScaleAndGradient(view, scale, fullDif,
                            tgtBox.x0, tgtBox.y0, tgtBox.x1, this.joinEnd, channel);

                    // Taper down region. Apply full scale correction but 
                    // gradually reduce the gradient correction
                    this.applyScaleAndGradientTaperDown(view, scale, fullDif, bgDif,
                            tgtBox.x0, this.joinEnd, tgtBox.x1, this.secondTaperEnd, channel);

                    // Taper has finished. Only apply scale and average offset
                    this.applyScaleAndAverageGradient(view, scale, bgDif,
                            tgtBox.x0, this.secondTaperEnd, tgtBox.x1, tgtBox.y1, channel);
                } else {
                    // Taper has not yet started. Only apply scale and average offset
                    this.applyScaleAndAverageGradient(view, scale, bgDif,
                            tgtBox.x0, tgtBox.y0, tgtBox.x1, this.firstTaperStart, channel);

                    // Taper up region. Apply full scale correction and 
                    // gradually increase the gradient correction from zero to full
                    this.applyScaleAndGradientTaperUp(view, scale, fullDif, bgDif,
                            tgtBox.x0, this.firstTaperStart, tgtBox.x1, this.joinStart, channel);

                    // Full correction from start of the join region to the end of the target image 
                    this.applyScaleAndGradient(view, scale, fullDif,
                            tgtBox.x0, this.joinStart, tgtBox.x1, tgtBox.y1,  channel);
                }
            } else {    // vertical join
                if (isTargetAfterRef) {
                    // Full correction from start of target up to end of the join region
                    this.applyScaleAndGradient(view, scale, fullDif,
                            tgtBox.x0, tgtBox.y0, this.joinEnd, tgtBox.y1, channel);

                    // Taper down region. Apply full scale correction but 
                    // gradually reduce the gradient correction
                    this.applyScaleAndGradientTaperDown(view, scale, fullDif, bgDif,
                            this.joinEnd, tgtBox.y0, this.secondTaperEnd, tgtBox.y1, channel);

                    // Taper has finished. Only apply scale and average offset
                    this.applyScaleAndAverageGradient(view, scale, bgDif,
                            this.secondTaperEnd, tgtBox.y0, tgtBox.x1, tgtBox.y1, channel);
                } else {
                    // Taper has not yet started. Only apply scale and average offset
                    this.applyScaleAndAverageGradient(view, scale, bgDif,
                            tgtBox.x0, tgtBox.y0, this.firstTaperStart, tgtBox.y1, channel);

                    // Taper down region. Apply full scale correction but 
                    // gradually reduce the gradient correction
                    this.applyScaleAndGradientTaperUp(view, scale, fullDif, bgDif,
                            this.firstTaperStart, tgtBox.y0, this.joinStart, tgtBox.y1, channel);

                    // Full correction from start of the join region to the end of the target image 
                    this.applyScaleAndGradient(view, scale, fullDif,
                            this.joinStart, tgtBox.y0, tgtBox.x1, tgtBox.y1, channel);
                }
            }
        } else if (propagateDifArray !== null){
            // No taper. Propogate full correction from start to end of target image
            this.applyScaleAndGradient(view, scale, propagateDifArray,
                    tgtBox.x0, tgtBox.y0, tgtBox.x1, tgtBox.y1, channel);
        } else {
            console.criticalln("No gradient specified!");
        }
        
    };
    
    /**
     * @param {View} tgtView
     * @param {Number} scale
     * @param {Number[]} difArray
     * @param {Number} x0
     * @param {Number} y0
     * @param {Number} x1
     * @param {Number} y1
     * @param {Number} channel
     */
    this.applyScaleAndGradient = function (tgtView, scale, difArray, 
            x0, y0, x1, y1, channel){
                
        if (x0 >= x1 || y0 >= y1)
            return;
        
        let row;
        let difArrayStart;

        let apply = function(samples){
            tgtView.image.getSamples(samples, row, channel);
            for (let i = 0; i < samples.length; i++) {
                if (samples[i]){ // do not modify black pixels
                    samples[i] = samples[i] * scale - difArray[difArrayStart + i];
                }
            }
            tgtView.image.setSamples(samples, row, channel);
        };
        
        if (this.isHorizontal){
            row = new Rect(x0, y0, x1, y0 + 1);
            let samples = new Float64Array(row.area);
            difArrayStart = x0;
            for (let y = y0; y < y1; y++) {
                row.moveTo(x0, y);
                apply(samples);
            }
        } else {
            row = new Rect(x0, y0, x0 + 1, y1);
            let samples = new Float64Array(row.area);
            difArrayStart = y0;
            for (let x = x0; x < x1; x++) {
                row.moveTo(x, y0);
                apply(samples);
            }
        }
    };
    
    /**
     * @param {View} tgtView
     * @param {Number} scale
     * @param {Number[]} difArray Apply to join
     * @param {Number[]} bgDif Apply outside join and taper areas
     * @param {Number} x0
     * @param {Number} y0
     * @param {Number} x1
     * @param {Number} y1
     * @param {Number} channel
     */
    this.applyScaleAndGradientTaperDown = function (tgtView, scale, difArray, bgDif,
            x0, y0, x1, y1, channel){
        
        if (x0 >= x1 || y0 >= y1)
            return;
        
        const self = this;
        let row;
        let difArrayStart;
        
        let apply = function(coord, taperStart, samples){
            tgtView.image.getSamples(samples, row, channel);
            for (let i = 0; i < samples.length; i++) {
                if (samples[i]){ // do not modify black pixels
                    const idx = difArrayStart + i;
                    const bg = bgDif[idx];
                    const delta = difArray[idx] - bg;
                    const fraction = 1 - (coord - taperStart) / self.taperLength;
                    const taper = bg + delta * fraction;
                    samples[i] = samples[i] * scale - taper;
                }
            }
            tgtView.image.setSamples(samples, row, channel);
        };
        
        if (this.isHorizontal){
            row = new Rect(x0, y0, x1, y0 + 1);
            let samples = new Float64Array(row.area);
            difArrayStart = x0;
            for (let y = y0; y < y1; y++) {
                row.moveTo(x0, y);
                apply(y, y0, samples);
            }
        } else {
            row = new Rect(x0, y0, x0 + 1, y1);
            let samples = new Float64Array(row.area);
            difArrayStart = y0;
            for (let x = x0; x < x1; x++) {
                row.moveTo(x, y0);
                apply(x, x0, samples);
            }
        }
    };
    
    /**
     * @param {View} tgtView
     * @param {Number} scale
     * @param {Number[]} difArray Apply to join
     * @param {Number[]} bgDif Apply outside join and taper areas
     * @param {Number} x0
     * @param {Number} y0
     * @param {Number} x1
     * @param {Number} y1
     * @param {Number} channel
     */
    this.applyScaleAndGradientTaperUp = function (tgtView, scale, difArray, bgDif, 
            x0, y0, x1, y1, channel){
                
        if (x0 >= x1 || y0 >= y1)
            return;
        
        const self = this;
        let row;
        let difArrayStart;
        let taperEnd;
        
        let apply = function(coord, samples){
            tgtView.image.getSamples(samples, row, channel);
            for (let i = 0; i < samples.length; i++) {
                if (samples[i]){ // do not modify black pixels
                    const idx = difArrayStart + i;
                    const bg = bgDif[idx];
                    const delta = difArray[idx] - bg;
                    let fraction = 1 - (taperEnd - coord) / self.taperLength;
                    const taper = bg + delta * fraction;
                    samples[i] = samples[i] * scale - taper;
                }
            }
            tgtView.image.setSamples(samples, row, channel);
        };
        
        if (this.isHorizontal){
            taperEnd = y1 - 1;
            row = new Rect(x0, y0, x1, y0 + 1);
            let samples = new Float64Array(row.area);
            difArrayStart = x0;
            for (let y = y0; y < y1; y++) {
                row.moveTo(x0, y);
                apply(y, samples);
            }
        } else {
            taperEnd = x1 - 1;
            row = new Rect(x0, y0, x0 + 1, y1);
            let samples = new Float64Array(row.area);
            difArrayStart = y0;
            for (let x = x0; x < x1; x++) {
                row.moveTo(x, y0);
                apply(x, samples);
            }
        }
    };
    
    /**
     * @param {View} tgtView
     * @param {Number} scale
     * @param {Number[]} bgDif Apply outside join and taper areas
     * @param {Number} x0
     * @param {Number} y0
     * @param {Number} x1
     * @param {Number} y1
     * @param {Number} channel
     */
    this.applyScaleAndAverageGradient = function (tgtView, scale, bgDif, 
            x0, y0, x1, y1, channel){
                
        if (x0 >= x1 || y0 >= y1)
            return;
        
        let row;
        let difArrayStart;
        let apply = function(samples){
            tgtView.image.getSamples(samples, row, channel);
            for (let i = 0; i < samples.length; i++) {
                if (samples[i]){ // do not modify black pixels
                    samples[i] = samples[i] * scale - bgDif[difArrayStart + i];
                }
            }
            tgtView.image.setSamples(samples, row, channel);
        };

        if (this.isHorizontal) {
            row = new Rect(x0, y0, x1, y0 + 1);
            let samples = new Float64Array(row.area);
            difArrayStart = x0;
            for (let y = y0; y < y1; y++) {
                row.moveTo(x0, y);
                apply(samples);
            }
        } else {
            row = new Rect(x0, y0, x0 + 1, y1);
            let samples = new Float64Array(row.area);
            difArrayStart = y0;
            for (let x = x0; x < x1; x++) {
                row.moveTo(x, y0);
                apply(samples);
            }
        }
    };
}

/**
 * Calculates maximum and minimum values for the samples and the best fit line(s)
 * @param {SamplePairs[]} colorSamplePairs Contains samplePairArray
 * @param {Gradient[]} initialGradients Apply this gradient to data points before calculating min max
 * @param {Gradient[]} gradients This stores the min and max line y values
 * @param {Boolean} isHorizontal 
 * @returns {SamplePairDifMinMax}
 */
function SamplePairDifMinMax(colorSamplePairs, initialGradients, gradients, isHorizontal) {
    let gradientData = gradients[0].getGradientData();
    this.minDif = gradientData.minLineValue;
    this.maxDif = gradientData.maxLineValue;
    if (gradients.length === 3){
        let gradientData1 = gradients[1].getGradientData();
        let gradientData2 = gradients[2].getGradientData();
        this.minDif = Math.min(this.minDif, gradientData1.minLineValue, gradientData2.minLineValue);
        this.maxDif = Math.max(this.maxDif, gradientData1.maxLineValue, gradientData2.maxLineValue);
    }
    
    for (let c=0; c<colorSamplePairs.length; c++) {
        let samplePairs = colorSamplePairs[c];
        for (let samplePair of samplePairs.samplePairArray) {
            // works for both horizontal and vertical
            let dif = samplePair.targetMedian - samplePair.referenceMedian;
            if (initialGradients !== null) {
                let coord = isHorizontal ? samplePair.rect.center.x : samplePair.rect.center.y;
                let initialDifArray = initialGradients[c].getGradientData().difArray;
                dif -= initialDifArray[coord];
            }
            this.minDif = Math.min(this.minDif, dif);
            this.maxDif = Math.max(this.maxDif, dif);
        }
    }
}

/**
 * Display graph of (difference between images) / (pixel distance across image)
 * @param {View} targetView Used for view name
 * @param {View} referenceView Used for view name
 * @param {Number} width Graph width. Limited to target image size (width or height).
 * @param {Boolean} isHorizontal
 * @param {Gradient[]} initialGradients If not null, apply this gradient to data points before displaying them
 * @param {Gradient[]} gradients Contains best fit gradient lines for each channel
 * @param {SamplePairs[]} colorSamplePairs The SamplePair points to be displayed (array contains color channels)
 * @param {PhotometricMosaicData} data User settings used to create FITS header
 * @returns {undefined}
 */
function displayGradientGraph(targetView, referenceView, width, isHorizontal, 
        initialGradients, gradients, colorSamplePairs, data){
            
    /**
     * @param {FITSKeyword[]} keywords
     * @param {Gradient[]} gradients
     * @returns {FITSKeyword[]}
     */
    let addOffsetsToFitsHeader = function (keywords, gradients){
        const nColors = gradients.length;
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
        return keywords;
    };
    
    /**
     * @param {View} refView
     * @param {View} tgtView
     * @param {ImageWindow} graphWindow Graph window
     * @param {Gradient[]} initialGradients The displayed graph line & points have already been corrected by this
     * @param {Gradient[]} gradients Contains best fit lines for each channel
     * @param {PhotometricMosaicData} data User settings used to create FITS header
     * @return {undefined}
     */
    let gradientGraphFitsHeader = function(refView, tgtView, graphWindow, initialGradients, gradients, data){
        let view = graphWindow.mainView;
        view.beginProcess(UndoFlag_NoSwapFile); // don't add to undo list
        let keywords = graphWindow.keywords;
        keywords.push(new FITSKeyword("COMMENT", "", "Ref: " + refView.fullId));
        keywords.push(new FITSKeyword("COMMENT", "", "Tgt: " + tgtView.fullId));
        keywords.push(new FITSKeyword("COMMENT", "", "Star Detection: " + data.logStarDetection));
        keywords.push(new FITSKeyword("COMMENT", "", "Sample Size: " + data.sampleSize));
        keywords.push(new FITSKeyword("COMMENT", "", "Limit Sample Stars Percent: " + data.limitSampleStarsPercent));
        if (data.viewFlag === DISPLAY_GRADIENT_GRAPH()){
            keywords.push(new FITSKeyword("COMMENT", "", "Gradient Best Fit Lines: " + data.nGradientBestFitLines));
            addOffsetsToFitsHeader(keywords, gradients);
        } else if (data.viewFlag === DISPLAY_GRADIENT_TAPER_GRAPH()){
            if (data.gradientFlag){
                keywords.push(new FITSKeyword("COMMENT", "", "Gradient Best Fit Lines: " + data.nGradientBestFitLines));
                addOffsetsToFitsHeader(keywords, initialGradients);
            }
            keywords.push(new FITSKeyword("COMMENT", "", "Taper Best Fit Lines: " + data.nTaperBestFitLines));
            keywords.push(new FITSKeyword("COMMENT", "", "Taper Length: " + data.taperLength));
            addOffsetsToFitsHeader(keywords, gradients);
        }
        
        graphWindow.keywords = keywords;
        view.endProcess();
    };
    /**
     * Draw gradient line and sample points for a single color channel.
     * @param {Graph} graph
     * @param {Boolean} isHorizontal
     * @param {Number[]} initialDifArray If not null, apply this to data points before displaying 
     * @param {EquationOfLine[]} eqnLines
     * @param {Number} lineColor
     * @param {SamplePairs} samplePairs
     * @param {Number} pointColor
     * @returns {undefined}
     */
    let drawLineAndPoints = function(graph, isHorizontal, initialDifArray,
            eqnLines, lineColor, samplePairs, pointColor) {
                
        for (let eqnLine of eqnLines){
            graph.drawLineSegment(eqnLine.m, eqnLine.b, lineColor, true, eqnLine.x0, eqnLine.x1);
        }
        for (let samplePair of samplePairs.samplePairArray) {
            // Draw the sample points
            let coord = isHorizontal ? samplePair.rect.center.x : samplePair.rect.center.y;
            let dif = samplePair.targetMedian - samplePair.referenceMedian;
            if (initialDifArray){
                dif -= initialDifArray[coord];
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
    let minMax = new SamplePairDifMinMax(colorSamplePairs, initialGradients, gradients, isHorizontal);
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
        let initialDifArray = initialGradients !== null ? initialGradients[0].getGradientData().difArray : null;
        drawLineAndPoints(graphWithAxis, isHorizontal, initialDifArray,
            gradients[0].getGradientLines(), 0xFFFFFFFF,
            colorSamplePairs[0], 0xFFFFFFFF);
        imageWindow = graphWithAxis.createWindow(windowTitle, false);
    } else {
        // Color. Need to create 3 graphs for r, g, b and then merge them (binary OR) so that
        // if three samples are on the same pixel we get white and not the last color drawn
        let lineColors = [0xFFFF0000, 0xFF00FF00, 0xFF0000FF]; // r, g, b
        let pointColors = [0xFFFF0000, 0xFF00FF00, 0xFF0000FF]; // r, g, b
        for (let c = 0; c < colorSamplePairs.length; c++){
            let initialDifArray = initialGradients !== null ? initialGradients[c].getGradientData().difArray : null;
            let graphAreaOnly = graphWithAxis.createGraphAreaOnly();
            drawLineAndPoints(graphAreaOnly, isHorizontal, initialDifArray,
                gradients[c].getGradientLines(), lineColors[c],
                colorSamplePairs[c], pointColors[c]);
            graphWithAxis.mergeWithGraphAreaOnly(graphAreaOnly);
        }
        imageWindow = graphWithAxis.createWindow(windowTitle, true);
    }
    gradientGraphFitsHeader(referenceView, targetView, imageWindow, initialGradients, gradients, data);
    imageWindow.show();
}
