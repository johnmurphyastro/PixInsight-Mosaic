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

#include "AkimaInterpolation.js"

/**
 * Creates a Point[] array were Point.x is the coordinate of a column of SamplePair
 * and Point.y is the average of all the SamplePair in that column and the neighboring columns.
 * It is a moving average, so it creates one entry for each column.
 * @param {SamplePair[]} samplePairs Sorted by distance along the column
 * @param {Number[]} smoothDifArray Initial correction to apply before calculating average
 * @param {Number} nColumns Number of columns to include in each average
 * @param {Boolean} isHorizontal
 * @returns {Point[]} Point.x is the coordinate of a column of SamplePair
 * and Point.y is the average of all the SamplePair in that column and the neighboring columns
 */
function calcMovingAverages(samplePairs, smoothDifArray, nColumns, isHorizontal){
    
    // Used by calcAverageDif()
    let firstSamplePairIdx = 0;
    
    /**
     * Create an average sample dif from all samples between x0 and x1.
     * This method relies upon the sort order of the samplePairs. It uses 
     * firstSamplePairIdx to determine where to start searching for new SamplePairs.
     * @param {SamplePair[]} samplePairs Sorted by increasing distance along join
     * @param {Number[]} smoothDifArray Initial correction to apply before calculating average
     * @param {Number} x0 lower end of sample region
     * @param {Number} x1 upper end of sample region
     * @param {Boolean} isHorizontal
     * @returns {Point} Point.x is the coordinate, Point.y is the averaged dif. Returns
     * null if no samples were found between x0 and x1
     */
    let calcAverageDif = function (samplePairs, smoothDifArray, x0, x1, isHorizontal){
        // Store all the sample positions and dif values between x0 and x1 in this array
        let sum = 0;
        let count = 0;
        for (let i = firstSamplePairIdx; i < samplePairs.length; i++) {
            let samplePair = samplePairs[i];
            let x = isHorizontal ? samplePair.rect.center.x : samplePair.rect.center.y;
            if (x > x1){
                break;
            }
            if (x > x0){
                let y = samplePair.targetMedian - samplePair.referenceMedian;
                if (smoothDifArray){
                    // initial correction has been supplied, so we must apply
                    // this correction before calculating the average
                    y -= smoothDifArray[x];
                }
                sum += y;
                count++;
            } else {
                // We only move by 1 column after processing each group of columns
                firstSamplePairIdx = i;
            }
        }
        if (count > 0){
            let center = x0 + ((x1 - 1) - x0) / 2;
            return new Point(center, sum / count);
        }
        return null;
    };
    
    /**
     * Creates a Point[] array were Point.x is the coordinate of a column of SamplePair
     * and Point.y is the average of all the SamplePair in that column and the neighboring columns.
     * It is a moving average, so it creates one entry for each column.
     * @param {SamplePair[]} samplePairs Sorted by increasing distance along join
     * @param {Number[]} smoothDifArray Initial correction to apply before calculating average
     * @param {Number} nColumns Number of columns to average over
     * @param {Boolean} isHorizontal
     * @returns {Point[]} Point.x is the coordinate, Point.y is the averaged dif. Returns
     * empty array if no samples were found.
     */
    let getMovingAverageArray = function (samplePairs, smoothDifArray, nColumns, isHorizontal){
        let d = samplePairs[0].rect.width;
        let lastIdx = samplePairs.length - 1;
        let startX = isHorizontal ? samplePairs[0].rect.x0 : samplePairs[0].rect.y0;
        let endX = isHorizontal ? samplePairs[lastIdx].rect.x1 : samplePairs[lastIdx].rect.y1;
        // TODO add check to check there are enough points.
        endX -= (nColumns * d) - 1;
        let ma = [];    // Moving Average array
        for (let x0 = startX; x0 < endX; x0 += d){
            let x1 = x0 + nColumns * d;
            let movingAvg = calcAverageDif(samplePairs, smoothDifArray, x0, x1, isHorizontal);
            if (movingAvg !== null){
                ma.push(movingAvg);
            }
        }
        
        if (ma.length > 5){
            // Apply some smoothing by fitting a line to 5 points
            // Then only keep two points from the line. These will be used by
            // Akima Interpolation to create a smooth curve.
            let remainder = ma.length % 5;
            let r = Math.floor(remainder / 2);
            let smoothedPoints = [];
            for (let i = 2 + r; i < ma.length - 2; i += 5){
                let lsf = new LeastSquareFitAlgorithm();
                for (let j = i - 2; j <= i + 2; j++){
                    lsf.addValue(ma[j].x, ma[j].y);
                }
                let fit = lsf.getLinearFit();
                let x = ma[i-1].x;
                let y = eqnOfLineCalcY(x, fit.m, fit.b);
                smoothedPoints.push(new Point(x, y));
                x = ma[i+1].x;
                y = eqnOfLineCalcY(x, fit.m, fit.b);
                smoothedPoints.push(new Point(x, y));
            }
            return smoothedPoints;
        }
        return ma;
    };
    
    return getMovingAverageArray(samplePairs, smoothDifArray, nColumns, isHorizontal);
}

/**
 * Use Akima Interpolation to create the difArray from the input points
 * @param {Number[]} xArray points along the x or y axis
 * @param {Number[]} yArray The corresponding value
 * @param {Number} maxIdx length of x or y axis
 * @returns {Number[]} difArray
 */
function createDifArray(xArray, yArray, maxIdx){
    let akima = new AkimaInterpolation(xArray, yArray);
    let difArray = [];
    for (let i = 0; i < maxIdx; i++) {
        let dif = akima.evaluate(i);
        difArray.push(dif);
    }
    return difArray;
}

/**
 * Calculates the offset gradient between the reference and target samples.
 * Represents the gradient in a single channel. (use 3 instances  for color images.)
 * If smoothDifArray is supplied, it is applied first before calculating difArray
 * @param {Image} tgtImage Get width and height from this image
 * @param {Rect} sampleRect The bounding box of all samples
 * @param {SamplePair[]} samplePairs median values from ref and tgt samples
 * @param {Number[]} smoothDifArray Propagated gradient difArray, or null
 * @param {Number} nColumns Average this number of sample columns together
 * @param {Boolean} isHorizontal
 * @returns {Number[]} difArray
 */
function calcMovingAverageDifArray(tgtImage, sampleRect, samplePairs, 
        smoothDifArray, nColumns, isHorizontal){
    const maxIdx = isHorizontal ? tgtImage.width : tgtImage.height;
    let sampleRectStart = isHorizontal ? sampleRect.x0 : sampleRect.y0;
    let sampleRectEnd = isHorizontal ? sampleRect.x1 : sampleRect.y1;
    
    let movingAverages = calcMovingAverages(samplePairs.samplePairArray, 
            smoothDifArray, nColumns, isHorizontal);

    let firstAvg = movingAverages[0].y;
    let lastAvg = movingAverages[movingAverages.length - 1].y;
    let xArray = [];
    let yArray = [];
    for (let x = 0; x < sampleRectStart; x++) {
        xArray.push(x);
        yArray.push(firstAvg);
    }
    for (let movingAverage of movingAverages) {
        xArray.push(movingAverage.x);
        yArray.push(movingAverage.y);
    }
    for (let x = sampleRectEnd; x < maxIdx; x++) {
        xArray.push(x);
        yArray.push(lastAvg);
    }
    return createDifArray(xArray, yArray, maxIdx);
}

/**
 * Calculates the offset gradient between the reference and target samples.
 * Represents the gradient in a single channel. (use 3 instances  for color images.)
 * @param {Image} tgtImage Get width and height from this image
 * @param {Rect} sampleRect The bounding box of all samples
 * @param {SamplePair[]} samplePairs median values from ref and tgt samples
 * @param {Number} nSections
 * @param {Boolean} isHorizontal
 * @returns {Number[]} difArray
 */
function calcSmoothDifArray(tgtImage, sampleRect, samplePairs, nSections, isHorizontal){
    const maxIdx = isHorizontal ? tgtImage.width : tgtImage.height;
    let sampleRectStart = isHorizontal ? sampleRect.x0 : sampleRect.y0;
    let sampleRectEnd = isHorizontal ? sampleRect.x1 : sampleRect.y1;
    
    let sampleSections = getSampleSections(samplePairs, nSections, isHorizontal);
    if (null === sampleSections){
        return null;
    }
    let xArray = [];
    let yArray = [];    
    // Add a horizontal line from x=0 to where the first line crosses the sampleRect
    // y0 = y1 = first line intercect with sampleRect
    // x0 = 0; x1 = start of sampleRect
    // Add point at (x0, y)
    let linearFitData = sampleSections[0].linearFitData;
    let y = eqnOfLineCalcY(sampleRectStart, linearFitData.m, linearFitData.b);
    for (let x = 0; x < sampleRectStart; x++) {
        xArray.push(x);
        yArray.push(y);
    }

    for (let section of sampleSections){
        // Create line segment 1/3 length of sample line.
        // This leaves 1/3 + 1/3 for each curve joining the lines
        let m = section.linearFitData.m;
        let b = section.linearFitData.b;
        let oneThird = (section.maxCoord - section.minCoord) / 3;
        let x = section.minCoord + oneThird;
        let y = eqnOfLineCalcY(x, m, b);
        xArray.push(x);
        yArray.push(y);
        x += oneThird;
        y = eqnOfLineCalcY(x, m, b);
        xArray.push(x);
        yArray.push(y);
    }
    
    // Add a horizontal line from where the last line crosses sampleRect to image end
    // y = y0 = y1 = intersection of last line with sampleRect
    // x0 = end of sampleRect; x1 = end of image
    linearFitData = sampleSections[sampleSections.length - 1].linearFitData;
    y = eqnOfLineCalcY(sampleRectEnd, linearFitData.m, linearFitData.b);
    for (let x = sampleRectEnd; x < maxIdx; x++) {
        xArray.push(x);
        yArray.push(y);
    }
    
    return createDifArray(xArray, yArray, maxIdx);
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
        
        samplePairArray.forEach((samplePair) => {
            let coord = isHorizontal ? samplePair.rect.center.x : samplePair.rect.center.y;
            let value = samplePair.targetMedian - samplePair.referenceMedian;
            algorithm.addValue(coord, value);
        });
        this.linearFitData = algorithm.getLinearFit();
        
        // If all points in this section were at the same coordinate the gradient will be infinite (invalid)
        return (this.linearFitData.m !== Number.POSITIVE_INFINITY &&
                this.linearFitData.m !== Number.NEGATIVE_INFINITY);
    };
}

/**
 * Split the sample coverage area into sections and calculate the gradient linear fit
 * for each section.
 * Returns an array of all the sections.
 * @param {SamplePairs} samplePairs Contains the SamplePairArray and their bounding box.
 * @param {Number} nSections The number of least square fit lines to calculate.
 * @param {Boolean} isHorizontal True if the mosaic join is a horizontal strip
 * @returns {SampleSection[]} Each entry contains the calculated best fit gradient line
 */
function getSampleSections (samplePairs, nSections, isHorizontal){
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
        let isValid = newSampleSection.calcLinearFit(samplePairs);
        if (!isValid){
            // Not enough samples in a section to calculate the line
            return null;
        }
        sections[i] = newSampleSection;
    }
    return sections;
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
 * Calculates maximum and minimum values for the sample points
 * @param {SamplePairs[]} colorSamplePairs Contains samplePairArray
 * @param {Number[][]} initialGradients For each color, apply this difArray to
 * data points before calculating min max
 * @param {Boolean} isHorizontal 
 * @returns {SamplePairDifMinMax}
 */
function SamplePairDifMinMax(colorSamplePairs, initialGradients, isHorizontal) {
    this.minDif = Number.POSITIVE_INFINITY;
    this.maxDif = Number.NEGATIVE_INFINITY;
    for (let c=0; c<colorSamplePairs.length; c++) {
        let samplePairs = colorSamplePairs[c];
        for (let samplePair of samplePairs.samplePairArray) {
            // works for both horizontal and vertical
            let dif = samplePair.targetMedian - samplePair.referenceMedian;
            if (initialGradients !== null) {
                let coord = isHorizontal ? samplePair.rect.center.x : samplePair.rect.center.y;
                let initialDifArray = initialGradients[c];
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
     * @param {View} refView
     * @param {View} tgtView
     * @param {ImageWindow} graphWindow Graph window
     * @param {PhotometricMosaicData} data User settings used to create FITS header
     * @return {undefined}
     */
    let gradientGraphFitsHeader = function(refView, tgtView, graphWindow, data){
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
        } else if (data.viewFlag === DISPLAY_GRADIENT_TAPER_GRAPH()){
            if (data.gradientFlag){
                keywords.push(new FITSKeyword("COMMENT", "", "Gradient Best Fit Lines: " + data.nGradientBestFitLines));
            }
            keywords.push(new FITSKeyword("COMMENT", "", "Taper Best Fit Lines: " + data.nTaperBestFitLines));
            keywords.push(new FITSKeyword("COMMENT", "", "Taper Length: " + data.taperLength));
        }
        
        graphWindow.keywords = keywords;
        view.endProcess();
    };
    /**
     * Draw gradient line and sample points for a single color channel.
     * @param {Graph} graph
     * @param {Boolean} isHorizontal
     * @param {Number[]} initialDifArray If not null, apply this to data points before displaying 
     * @param {Number[]} difArray
     * @param {Number} lineColor
     * @param {SamplePairs} samplePairs
     * @param {Number} pointColor
     * @returns {undefined}
     */
    let drawLineAndPoints = function(graph, isHorizontal, initialDifArray,
            difArray, lineColor, samplePairs, pointColor) {
                
        graph.drawDifArray(difArray, lineColor, true);
        
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
    let minMax = new SamplePairDifMinMax(colorSamplePairs, initialGradients, isHorizontal);
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
        let initialDifArray = initialGradients !== null ? initialGradients[0] : null;
        let difArray = gradients[0];
        drawLineAndPoints(graphWithAxis, isHorizontal, initialDifArray,
            difArray, 0xFFFFFFFF, colorSamplePairs[0], 0xFFFFFFFF);
    } else {
        // Color. Need to create 3 graphs for r, g, b and then merge them (binary OR) so that
        // if three samples are on the same pixel we get white and not the last color drawn
        let lineColors = [0xFFFF0000, 0xFF00FF00, 0xFF0000FF]; // r, g, b
        let pointColors = [0xFFFF0000, 0xFF00FF00, 0xFF0000FF]; // r, g, b
        for (let c = 0; c < colorSamplePairs.length; c++){
            let initialDifArray = initialGradients !== null ? initialGradients[c] : null;
            let difArray = gradients[c];
            let graphAreaOnly = graphWithAxis.createGraphAreaOnly();
            drawLineAndPoints(graphAreaOnly, isHorizontal, initialDifArray,
                difArray, lineColors[c], colorSamplePairs[c], pointColors[c]);
            graphWithAxis.mergeWithGraphAreaOnly(graphAreaOnly);
        }
    }
    // Display graph in script dialog
    GraphDialog.prototype = new Dialog;
    let graph = new GraphDialog(graphWithAxis.bitmap, "Gradient Graph", graphWithAxis.screenToWorld);
    if (graph.execute() === StdButton_Yes){
        // User requested graph saved to PixInsight View
        let isColor = targetView.image.isColor;
        let windowTitle = WINDOW_ID_PREFIX() + targetView.fullId + "__Gradient";
        let imageWindow = graphWithAxis.createWindow(windowTitle, isColor);
        gradientGraphFitsHeader(referenceView, targetView, imageWindow, data);
        imageWindow.show();
    }
}
