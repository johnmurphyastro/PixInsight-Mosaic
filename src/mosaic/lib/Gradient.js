/* global UndoFlag_NoSwapFile, GraphDialog, StdButton_Yes */

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
 * Create difference array for the horizontal line at y.
 * Between minX and maxX, the difference is calculated from the SurfaceSpline.
 * Outside this range, the values at minX and maxX are propogated to the array ends.
 * @param {SurfaceSpline} surfaceSpline
 * @param {Number} y Specifies the horizontal line
 * @param {Number} minX Hold difference constant until minX
 * @param {Number} maxX Hold difference constant after maxX
 * @param {Number} maxIndex Length of dif array (width of image)
 * @returns {Number[]} Difference array
 */
function createDifArrayX(surfaceSpline, y, minX, maxX, maxIndex){
    // calculate the difArray between minY and maxY
    let points = new Array(maxX - minX);
    for (let x = minX; x<maxX; x++){
        points[x - minX] = new Point(x, y);
    }
    let splineArray = (surfaceSpline.evaluate(points)).toArray();
    
    // From 0 to minY, set value to value at minY
    let startValue = splineArray[0];
    let startArray = new Array(minX);
    for (let x = 0; x < minX; x++){
        startArray[x] = startValue;
    }
    
    // Create difArray from 0 to maxY
    let difArray = startArray.concat(splineArray);
    
    // From maxY to end, set value to the value at maxY
    let endValue = splineArray[splineArray.length - 1];
    for (let x = maxX; x < maxIndex; x++){
        difArray.push(endValue);
    }
    return difArray;
}

/**
 * Create difference array for the vertical line at x.
 * Between minY and maxY, the difference is calculated from the SurfaceSpline.
 * Outside this range, the values at minY and maxY are propogated to the array ends.
 * @param {SurfaceSpline} surfaceSpline
 * @param {Number} x Specifies the vertical line
 * @param {Number} minY Hold difference constant until minY
 * @param {Number} maxY Hold difference constant after maxY
 * @param {Number} maxIndex Length of dif array (height of image)
 * @returns {Number[]} Difference array
 */
function createDifArrayY(surfaceSpline, x, minY, maxY, maxIndex){
    // calculate the difArray between minY and maxY
    let points = new Array(maxY - minY);
    for (let y = minY; y<maxY; y++){
        points[y - minY] = new Point(x, y);
    }
    let splineArray = (surfaceSpline.evaluate(points)).toArray();
    
    // From 0 to minY, set value to value at minY
    let startValue = splineArray[0];
    let startArray = new Array(minY);
    for (let y = 0; y < minY; y++){
        startArray[y] = startValue;
    }
    
    // Create difArray from 0 to maxY
    let difArray = startArray.concat(splineArray);
    
    // From maxY to end, set value to the value at maxY
    let endValue = splineArray[splineArray.length - 1];
    for (let y = maxY; y < maxIndex; y++){
        difArray.push(endValue);
    }
    return difArray;
}

/**
 * Create a new difArray where each value equals the average of the input array
 * @param {Number[]} difArray
 * @returns {Number[]} Output array is filled with average difArray value
 */
function createAvgDifArray(difArray){
    const length = difArray.length;
    const average = Math.mean(difArray);
    let avgDifArray = new Array(length);
    for (let i=0; i<length; i++){
        avgDifArray[i] = average;
    }
    return avgDifArray;
}

/**
 * Calculates a surface spline representing the difference between reference and target samples.
 * Represents the gradient in a single channel. (use 3 instances  for color images.)
 * For performance, if there are more than 2000 samples, the samples are binned
 * into super samples. The binning in x and y directions may differ to ensure that
 * the 'thickness' of the join is not reduced to less than 5 samples by the binning.
 * @param {Rect} sampleRect The bounding box of all samples
 * @param {SamplePair[]} samplePairs median values from ref and tgt samples
 * @param {Number} logSmoothing Logrithmic value; larger values smooth more
 * @param {Boolean} isHorizontal Join direction. 
 * @returns {SurfaceSpline}
 */
function calcSurfaceSpline(sampleRect, samplePairs, logSmoothing, isHorizontal /*, tgtView, detectedStars, data*/){
    const minRows = 5;
    let sampleMaxLimit = 2000;
    let samplePairArray = samplePairs.samplePairArray;
    if (samplePairArray.length > sampleMaxLimit){
        let binnedSampleArray = createBinnedSamplePairArray(sampleRect, samplePairArray, 
                sampleMaxLimit, minRows, isHorizontal);
        if (binnedSampleArray.length > sampleMaxLimit){
            // This can happen because many samples in grid were rejected due to stars
            sampleMaxLimit *= sampleMaxLimit / binnedSampleArray.length;
            binnedSampleArray = createBinnedSamplePairArray(sampleRect, samplePairArray, 
                sampleMaxLimit, minRows, isHorizontal);
        }
        /* Test displays
        displaySampleSquares(tgtView, samplePairs, detectedStars, "Unbinned", data);
        let newSamplePairs = new SamplePairs(binnedSampleArray, 0, samplePairs.overlapBox);
        displaySampleSquares(tgtView, newSamplePairs, detectedStars, "Binned", data);
        */
        samplePairArray = binnedSampleArray;
    }

    const length = samplePairArray.length;
    let xVector = new Vector(length);
    let yVector = new Vector(length);
    let zVector = new Vector(length);
    let wVector = new Vector(length);
    for (let i=0; i<length; i++){
        let samplePair = samplePairArray[i];
        xVector.at(i, samplePair.rect.center.x);
        yVector.at(i, samplePair.rect.center.y);
        zVector.at(i, samplePair.targetMedian - samplePair.referenceMedian);
        wVector.at(i, samplePair.weight);
    }
    
    let ss = new SurfaceSpline();
    ss.smoothing = Math.pow(10.0, logSmoothing);
    processEvents();
    ss.initialize(xVector, yVector, zVector, wVector);
    if (!ss.isValid){
        // TODO throw exception
        (new MessageBox("Error: SurfaceSpline is invalid.", "calcSuraceSpline", StdIcon_Error, StdButton_Ok)).execute();
        return null;
    }
    return ss;
}

/**
 * This class is used to apply the scale and gradient to the target image
 * @param {Number} imageWidth
 * @param {Number} imageHeight
 * @param {Rect} sampleRect Bounding box of all samples
 * @param {Rect} joinRect The specified join area (sampleRect extended along join to overlapBox)
 * @param {Boolean} isHorizontal If true, the join is horizontal (one image is above the other)
 * @param {PhotometricMosaicData} data 
 * @param {Boolean} isTargetAfterRef True if target image is below or right of reference image
 * @returns {ScaleAndGradientApplier}
 */
function ScaleAndGradientApplier(imageWidth, imageHeight, sampleRect, joinRect, isHorizontal, 
        data, isTargetAfterRef) {
    this.imageWidth = imageWidth;
    this.imageHeight = imageHeight;
    this.createMosaic = data.createMosaicFlag;
    this.mosaicRandomFlag = data.mosaicRandomFlag;
    this.mosaicAverageFlag = data.mosaicAverageFlag;
    this.mosaicOverlayRefFlag = data.mosaicOverlayRefFlag;
    this.mosaicOverlayTgtFlag = data.mosaicOverlayTgtFlag;
    this.sampleRect = sampleRect;
    this.taperFlag = data.taperFlag;
    this.taperLength = data.taperFlag ? data.taperLength : 0;
    this.isTargetAfterRef = isTargetAfterRef;
    this.isHorizontal = isHorizontal;
    if (isHorizontal){
        this.firstTaperStart = Math.max(0, joinRect.y0 - this.taperLength); // joinStart - taperLength
        this.joinStart = joinRect.y0;
        this.joinEnd = joinRect.y1;
        this.secondTaperEnd = Math.min(imageHeight, joinRect.y1 + this.taperLength); // joinEnd + taperLength
    } else {
        this.firstTaperStart = Math.max(0, joinRect.x0 - this.taperLength);
        this.joinStart = joinRect.x0;
        this.joinEnd = joinRect.x1;
        this.secondTaperEnd = Math.min(imageWidth, joinRect.x1 + this.taperLength);
    }
    
    let lastProgressPc;
    function progressCallback(count, total){
        if (count === 0){
            console.write("<end>   0%");
            lastProgressPc = 0;
            processEvents();
        } else {
            let pc = Math.round(100 * count / total);
            if (pc > lastProgressPc && (pc > lastProgressPc + 5 || pc === 100)){
                console.write(format("\b\b\b\b%3d%%", pc));
                lastProgressPc = pc;
                processEvents();
            }
        }
    }
    
    /**
     * Applies the scale and gradient correction to the supplied view.
     * 
     * @param {Image} refImage Read access only
     * @param {Image} tgtImage Read access only
     * @param {View} view Blank image, will become mosaic image or corrected target image
     * @param {Number} scale
     * @param {SurfaceSpline} propagateSurfaceSpline
     * @param {SurfaceSpline} taperSurfaceSpline
     * @param {Rect} tgtBox Target image bounding box
     * @param {Number} channel
     * @returns {undefined}
     */
    this.applyAllCorrections = function (refImage, tgtImage, view, scale,
            propagateSurfaceSpline, taperSurfaceSpline, tgtBox, channel){
                
        processEvents();
        
        let fullDifBeforeJoin;
        let fullDifAfterJoin;
        let bgDifBeforeJoin;
        let bgDifAfterJoin;
        let joinSurfaceSpline;
        let length;
        
        if (this.taperFlag){
            joinSurfaceSpline = taperSurfaceSpline;
        } else {
            joinSurfaceSpline = propagateSurfaceSpline;
        }
        
        if (this.isHorizontal){
            let minX = this.sampleRect.x0;
            let maxX = this.sampleRect.x1;
            length = this.imageWidth;
            fullDifBeforeJoin = createDifArrayX(joinSurfaceSpline, this.joinStart, minX, maxX, length);
            fullDifAfterJoin = createDifArrayX(joinSurfaceSpline, this.joinEnd, minX, maxX, length);
            if (this.taperFlag && propagateSurfaceSpline !== null){
                if (this.isTargetAfterRef){
                    bgDifAfterJoin = createDifArrayX(propagateSurfaceSpline, this.joinEnd, minX, maxX, length);
                } else {
                    bgDifBeforeJoin = createDifArrayX(propagateSurfaceSpline, this.joinStart, minX, maxX, length);
                }     
            }
        } else {
            let minY = this.sampleRect.y0;
            let maxY = this.sampleRect.y1;
            length = this.imageHeight;
            fullDifBeforeJoin = createDifArrayY(joinSurfaceSpline, this.joinStart, minY, maxY, length);
            fullDifAfterJoin = createDifArrayY(joinSurfaceSpline, this.joinEnd, minY, maxY, length);
            if (this.taperFlag && propagateSurfaceSpline !== null){
                if (this.isTargetAfterRef){
                    bgDifAfterJoin = createDifArrayY(propagateSurfaceSpline, this.joinEnd, minY, maxY, length);
                } else {
                    bgDifBeforeJoin = createDifArrayY(propagateSurfaceSpline, this.joinStart, minY, maxY, length);
                }
            }
        }
        
        if (this.taperFlag) {            
            if (propagateSurfaceSpline === null){
                if (this.isTargetAfterRef){
                    bgDifAfterJoin = createAvgDifArray(fullDifAfterJoin);
                } else {
                    bgDifBeforeJoin = createAvgDifArray(fullDifBeforeJoin);
                }
            }
        } else {
            // Propagate gradient. Apply full dif over whole of target image
            bgDifBeforeJoin = fullDifBeforeJoin;
            bgDifAfterJoin = fullDifAfterJoin;
        }

        if (this.isHorizontal) {
            if (this.isTargetAfterRef) {
                // Reference side of join
                // Full correction from start of target up to start of the join region
                this.applyScaleAndGradient(refImage, tgtImage, view, scale, fullDifBeforeJoin,
                        tgtBox.x0, tgtBox.y0, tgtBox.x1, this.joinStart, channel, false);

                // Full correction from start of join up to end of the join region
                this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                        tgtBox.x0, this.joinStart, tgtBox.x1, this.joinEnd, channel);

                if (this.taperFlag) {
                    // Taper down region. Apply full scale correction but 
                    // gradually reduce the gradient correction
                    this.applyScaleAndGradientTaperDown(refImage, tgtImage, view, scale, fullDifAfterJoin, bgDifAfterJoin,
                            tgtBox.x0, this.joinEnd, tgtBox.x1, this.secondTaperEnd, channel);
                }

                // Target side of join
                // If taper: Taper has finished. Only apply scale and average offset
                // No taper: bgDif === fullDif. Apply full correction.
                this.applyScaleAndGradient(refImage, tgtImage, view, scale, bgDifAfterJoin,
                        tgtBox.x0, this.secondTaperEnd, tgtBox.x1, tgtBox.y1, channel, true);
            } else {
                // Target side of join
                // If taper: Taper has not yet started. Only apply scale and average offset
                // No taper: bgDif === fullDif. Apply full correction.
                this.applyScaleAndGradient(refImage, tgtImage, view, scale, bgDifBeforeJoin,
                        tgtBox.x0, tgtBox.y0, tgtBox.x1, this.firstTaperStart, channel, true);

                if (this.taperFlag) {
                    // Taper up region. Apply full scale correction and 
                    // gradually increase the gradient correction from zero to full
                    this.applyScaleAndGradientTaperUp(refImage, tgtImage, view, scale, fullDifBeforeJoin, bgDifBeforeJoin,
                            tgtBox.x0, this.firstTaperStart, tgtBox.x1, this.joinStart, channel);
                }

                // Full correction from start of the join region to the end of join region 
                this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                        tgtBox.x0, this.joinStart, tgtBox.x1, this.joinEnd, channel);

                // Reference side of join
                // Full correction from end of the join region to the end of the target image 
                this.applyScaleAndGradient(refImage, tgtImage, view, scale, fullDifAfterJoin,
                        tgtBox.x0, this.joinEnd, tgtBox.x1, tgtBox.y1, channel, false);
            }
        } else {    // vertical join
            if (isTargetAfterRef) {
                // Reference side of join
                // Full correction from start of target up to start of the join region
                this.applyScaleAndGradient(refImage, tgtImage, view, scale, fullDifBeforeJoin,
                        tgtBox.x0, tgtBox.y0, this.joinStart, tgtBox.y1, channel, false);

                // Full correction from start of join up to end of the join region
                this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                        this.joinStart, tgtBox.y0, this.joinEnd, tgtBox.y1, channel);

                if (this.taperFlag) {
                    // Taper down region. Apply full scale correction but 
                    // gradually reduce the gradient correction
                    this.applyScaleAndGradientTaperDown(refImage, tgtImage, view, scale, fullDifAfterJoin, bgDifAfterJoin,
                            this.joinEnd, tgtBox.y0, this.secondTaperEnd, tgtBox.y1, channel);
                }
                
                // Target side of join
                // If taper: Taper has finished. Only apply scale and average offset
                // No taper: bgDif === fullDif. Apply full correction.
                this.applyScaleAndGradient(refImage, tgtImage, view, scale, bgDifAfterJoin,
                        this.secondTaperEnd, tgtBox.y0, tgtBox.x1, tgtBox.y1, channel, true);
            } else {
                // Target side of join
                // If taper: Taper has not yet started. Only apply scale and average offset
                // No taper: bgDif === fullDif. Apply full correction.
                this.applyScaleAndGradient(refImage, tgtImage, view, scale, bgDifBeforeJoin,
                        tgtBox.x0, tgtBox.y0, this.firstTaperStart, tgtBox.y1, channel, true);

                if (this.taperFlag) {
                    // Taper down region. Apply full scale correction but 
                    // gradually reduce the gradient correction
                    this.applyScaleAndGradientTaperUp(refImage, tgtImage, view, scale, fullDifBeforeJoin, bgDifBeforeJoin,
                            this.firstTaperStart, tgtBox.y0, this.joinStart, tgtBox.y1, channel);
                }

                // Full correction from start of the join region to the end of join 
                this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                        this.joinStart, tgtBox.y0, this.joinEnd, tgtBox.y1, channel);

                // Reference side of join
                // Full correction from end of the join region to the end of the target image 
                this.applyScaleAndGradient(refImage, tgtImage, view, scale, fullDifAfterJoin,
                        this.joinEnd, tgtBox.y0, tgtBox.x1, tgtBox.y1, channel, false);
            }
        }
        
    };
    
    /**
     * Create row from reference and target row, applying scale and gradient.
     * This is used for regions either before the taper and join or after taper and join.
     * The applied difArray is constant for all rows in this region.
     * If only creating a corrected target image, the reference row must only contain zeros.
     * @param {Image} refImage Read Only
     * @param {Image} tgtImage Read Only
     * @param {View} mosaicView Scale and gradient will be applied. No taper.
     * @param {Number} scale Scale to apply
     * @param {Number[]} difArray Gradient to apply
     * @param {Number} x0 Region's min x
     * @param {Number} y0 Region's min y
     * @param {Number} x1 Region's max x
     * @param {Number} y1 Region's max y
     * @param {Number} channel
     * @param {Boolean} isTargetSide True if x0,x1,y0,y1 bounding box is on target side of join
     */
    this.applyScaleAndGradient = function (refImage, tgtImage, mosaicView,
            scale, difArray, x0, y0, x1, y1, channel, isTargetSide){
                
        if (x0 >= x1 || y0 >= y1)
            return;

        const self = this;
        
        /**
         * Create row from reference and target row, applying scale and gradient.
         * This is used for regions either before the taper and join or after taper and join.
         * The applied difArray is constant for all rows in this region.
         * If only creating a corrected target image, the reference row must only contain zeros.
         * @param {Float64Array} refSamples Row used to read reference samples, or zeros if not creating mosaic
         * @param {Float64Array} tgtSamples Row used to read target samples
         * @param {Float64Array} samples Output stored in this row
         * @param {Rect} row Work on pixels within this rectangle
         * @param {Number[]} difArray Difference between reference and target image
         * along a horizontal or vertical line
         * @param {Number} difArrayStart The difArray index corresponding to row start
         */
        let apply = function(refSamples, tgtSamples, samples, row, difArray, difArrayStart){
            tgtImage.getSamples(tgtSamples, row, channel);
            if (self.createMosaic){
                refImage.getSamples(refSamples, row, channel);
            }
            for (let i = 0; i < samples.length; i++) {
                if (isTargetSide){
                    // Target overlays reference
                    if (tgtSamples[i]){
                        samples[i] = tgtSamples[i] * scale - difArray[difArrayStart + i];
                    } else if (refSamples[i]){
                        samples[i] = refSamples[i];
                    } else {
                        samples[i] = 0;
                    }
                } else {
                    // Reference overlays target
                    if (refSamples[i]){
                        samples[i] = refSamples[i];
                    } else if (tgtSamples[i]){
                        samples[i] = tgtSamples[i] * scale - difArray[difArrayStart + i];
                    } else {
                        samples[i] = 0;
                    }
                }
            }
            mosaicView.image.setSamples(samples, row, channel);
        };
        console.write("Processing target[",channel,"]");
        if (this.isHorizontal){
            let row = new Rect(x0, y0, x1, y0 + 1);
            let refSamples = new Float64Array(row.area);
            let tgtSamples = new Float64Array(row.area);
            let samples = new Float64Array(row.area);
            let difArrayStart = x0;
            let lastRow = y1 - y0 - 1;
            for (let y = y0; y < y1; y++) {
                row.moveTo(x0, y);
                apply(refSamples, tgtSamples, samples, row, difArray, difArrayStart);
                progressCallback(y - y0, lastRow);
            }
        } else {
            let row = new Rect(x0, y0, x0 + 1, y1);
            let refSamples = new Float64Array(row.area);
            let tgtSamples = new Float64Array(row.area);
            let samples = new Float64Array(row.area);
            let difArrayStart = y0;
            let lastRow = x1 - x0 - 1;
            for (let x = x0; x < x1; x++) {
                row.moveTo(x, y0);
                apply(refSamples, tgtSamples, samples, row, difArray, difArrayStart);
                progressCallback(x - x0, lastRow);
            }
        }
        console.writeln();
    };
    
    /**
     * Create row from reference and target row, applying scale and gradient
     * and using the mosaic join mode (overlayRef, overlayTgt, random or average)
     * If only creating a corrected target image, the reference row must only 
     * contain zeros (all join modes then effectively become target overlay).
     * @param {Image} refImage Read Only
     * @param {Image} tgtImage Read Only
     * @param {View} mosaicView Uses ref overlay, tgt overlay, random or average combien.
     * @param {Number} scale Scale to apply
     * @param {surfaceSpline} surfaceSpline Gradient to apply
     * @param {Number} x0 Region's min x
     * @param {Number} y0 Region's min y
     * @param {Number} x1 Region's max x
     * @param {Number} y1 Region's max y
     * @param {Number} channel
     */
    this.applyScaleAndGradientToJoin = function (refImage, tgtImage, mosaicView,
            scale, surfaceSpline, x0, y0, x1, y1, channel){
                
        if (x0 >= x1 || y0 >= y1)
            return;
        
        const self = this;

        let SurfaceSplinePoints = function(){
            this.indexs = [];
            this.points = [];
            this.addPoint = function (i, x, y){
                this.indexs.push(i);
                this.points.push(new Point(x, y));
            };
        };

        /**
         * Create row from reference and target row, applying scale and gradient
         * and using the mosaic join mode (overlayRef, overlayTgt, random or average)
         * If only creating a corrected target image, the reference row must only 
         * contain zeros (all join modes then effectively become target overlay).
         * @param {Float64Array} refSamples Row used to read reference samples, or zeros if not creating mosaic
         * @param {Float64Array} tgtSamples Row used to read target samples
         * @param {Float64Array} samples Output stored in this row
         * @param {Rect} row Apply correction to this row of the SampleRect
         * @param {SurfaceSpline} surfaceSpline gradient correction to apply
         * @param {Boolean} isHorizontal True if this row is horizontal
         */
        let apply = function(refSamples, tgtSamples, samples, row, surfaceSpline, isHorizontal){
            tgtImage.getSamples(tgtSamples, row, channel);
            if (self.createMosaic){
                refImage.getSamples(refSamples, row, channel);
            }
            let surfaceSplinePoints = new SurfaceSplinePoints();
            let x = row.x0;
            let y = row.y0;
            for (let i = 0; i < samples.length; i++) {
                if (isHorizontal){
                    x = row.x0 + i;
                } else {
                    y = row.y0 + i;
                }
                if (self.mosaicRandomFlag){
                    if (tgtSamples[i]){
                        if (!refSamples[i] || Math.random() < 0.5){
                            // tgt exists. Either ref did not (target overlay) or tgt won random contest
                            samples[i] = tgtSamples[i] * scale;
                            surfaceSplinePoints.addPoint(i, x, y); // offset removed later
                        } else {
                            // tgt exists. ref exists. ref won random contest.
                            samples[i] = refSamples[i];
                        }
                    } else {
                        // tgt does not exist. Set to ref (which may be zero or non zero)
                        samples[i] = refSamples[i];
                    }
                } else if (self.mosaicOverlayRefFlag){
                    if (refSamples[i]){
                        // ref exists
                        samples[i] = refSamples[i];
                    } else if (tgtSamples[i]){
                        // ref did not exist but tgt does, so use tgt.
                        samples[i] = tgtSamples[i] * scale;
                        surfaceSplinePoints.addPoint(i, x, y); // offset removed later
                    } else {
                        // Both ref and tgt did not exist
                        samples[i] = 0;
                    }
                } else if (self.mosaicOverlayTgtFlag){
                    if (tgtSamples[i]){
                        // tgt exists
                        samples[i] = tgtSamples[i] * scale;
                        surfaceSplinePoints.addPoint(i, x, y); // offset removed later
                    } else {
                        // tgt did not exist. Use ref (which may be zero or non zero)
                        samples[i] = refSamples[i];
                    }
                } else if (self.mosaicAverageFlag){
                    if (tgtSamples[i]){
                        // tgt exists
                        samples[i] = tgtSamples[i] * scale;
                        surfaceSplinePoints.addPoint(i, x, y); // offset removed later
                    } else {
                        // tgt does not exist. Use ref (which may be zero or non zero)
                        samples[i] = refSamples[i];
                    }
                }
            }
            
            // Remove the surfaceSpline offsets
            if (surfaceSplinePoints.points.length > 0){
                let length = surfaceSplinePoints.points.length;
                let offsets = surfaceSpline.evaluate(surfaceSplinePoints.points);
                for (let i=0; i<length; i++){
                    let idx = surfaceSplinePoints.indexs[i];
                    samples[idx] -= offsets.at(i);
                    if (self.mosaicAverageFlag && refSamples[idx]){
                        // Average mode. Ref exists so need to calc average
                        samples[idx] = (samples[idx] + refSamples[idx]) / 2;
                    }
                }
            }
            
            mosaicView.image.setSamples(samples, row, channel);
        };
        
        console.write("Processing join  [",channel,"]");
        if (this.isHorizontal){
            let row = new Rect(x0, y0, x1, y0 + 1);
            let refSamples = new Float64Array(row.area);
            let tgtSamples = new Float64Array(row.area);
            let samples = new Float64Array(row.area);
            let lastRow = y1 - y0 - 1;
            for (let y = y0; y < y1; y++) {
                row.moveTo(x0, y);
                apply(refSamples, tgtSamples, samples, row, surfaceSpline, true);
                progressCallback(y - y0, lastRow);
            }
        } else {
            let row = new Rect(x0, y0, x0 + 1, y1);
            let refSamples = new Float64Array(row.area);
            let tgtSamples = new Float64Array(row.area);
            let samples = new Float64Array(row.area);
            let lastRow = x1 - x0 - 1;
            for (let x = x0; x < x1; x++) {
                row.moveTo(x, y0);
                apply(refSamples, tgtSamples, samples, row, surfaceSpline, false);
                progressCallback(x - x0, lastRow);
            }
        }
        console.writeln();
    };
    
    /**
     * @param {Image} refImage Read Only
     * @param {Image} tgtImage Read Only
     * @param {View} mosaicView
     * @param {Number} scale Scale to apply
     * @param {Number[]} difArray 100% at join edge and then taper down
     * @param {Number[]} bgDif Apply outside join and taper areas
     * @param {Number} x0 Region's min x
     * @param {Number} y0 Region's min y
     * @param {Number} x1 Region's max x
     * @param {Number} y1 Region's max y
     * @param {Number} channel
     */
    this.applyScaleAndGradientTaperDown = function (refImage, tgtImage, mosaicView,
            scale, difArray, bgDif, x0, y0, x1, y1, channel){
        
        if (x0 >= x1 || y0 >= y1)
            return;
        
        const self = this;
        
        /**
         * Create row from reference and target row, applying scale, gradient and taper.
         * If only creating a corrected target image, the reference row must only contain zeros.
         * @param {Number} coord X or Y coordinate of current row
         * @param {Number} taperStart X or Y coordinate of taper start (i.e. at join edge)
         * @param {Float64Array} refSamples Row used to read reference samples, or zeros if not creating mosaic
         * @param {Float64Array} tgtSamples Row used to read target samples
         * @param {Float64Array} samples Output stored in this row
         * @param {Rect} row Work on pixels within this rectangle
         * @param {Number[]} difArray Difference between reference and target image
         * along a horizontal or vertical line, valid at the join edge
         * @param {Number[]} bgDif Difference between reference and target image
         * along a horizontal or vertical line, valid after taper has finished
         * @param {Number} difArrayStart The difArray index corresponding to row start
         */
        let apply = function(coord, taperStart, refSamples, tgtSamples, samples, 
                row, difArray, bgDif, difArrayStart){
            tgtImage.getSamples(tgtSamples, row, channel);
            if (self.createMosaic){
                refImage.getSamples(refSamples, row, channel);
            }
            for (let i = 0; i < samples.length; i++) {
                if (tgtSamples[i]){
                    // tgt sample exists. We only taper tgt samples
                    const idx = difArrayStart + i;
                    const bg = bgDif[idx];
                    const delta = difArray[idx] - bg;
                    const fraction = 1 - (coord - taperStart) / self.taperLength;
                    const taper = bg + delta * fraction;
                    samples[i] = tgtSamples[i] * scale - taper;
                } else {
                    // No tgt sample. Use ref (which may be zero or non zero)
                    samples[i] = refSamples[i];
                }
            }
            mosaicView.image.setSamples(samples, row, channel);
        };
        
        console.write("Processing taper [",channel,"]");
        if (this.isHorizontal){
            let row = new Rect(x0, y0, x1, y0 + 1);
            let refSamples = new Float64Array(row.area);
            let tgtSamples = new Float64Array(row.area);
            let samples = new Float64Array(row.area);
            let difArrayStart = x0;
            let lastRow = y1 - y0 - 1;
            for (let y = y0; y < y1; y++) {
                row.moveTo(x0, y);
                apply(y, y0, refSamples, tgtSamples, samples, row, difArray, bgDif, difArrayStart);
                progressCallback(y - y0, lastRow);
            }
        } else {
            let row = new Rect(x0, y0, x0 + 1, y1);
            let refSamples = new Float64Array(row.area);
            let tgtSamples = new Float64Array(row.area);
            let samples = new Float64Array(row.area);
            let difArrayStart = y0;
            let lastRow = x1 - x0 - 1;
            for (let x = x0; x < x1; x++) {
                row.moveTo(x, y0);
                apply(x, x0, refSamples, tgtSamples, samples, row, difArray, bgDif, difArrayStart);
                progressCallback(x - x0, lastRow);
            }
        }
        console.writeln();
    };
    
    /**
     * @param {Image} refImage Read Only
     * @param {Image} tgtImage Read Only
     * @param {View} mosaicView
     * @param {Number} scale Scale to apply
     * @param {Number[]} difArray Taper up to 100% at join edge
     * @param {Number[]} bgDif Apply outside join and taper areas
     * @param {Number} x0
     * @param {Number} y0
     * @param {Number} x1
     * @param {Number} y1
     * @param {Number} channel
     */
    this.applyScaleAndGradientTaperUp = function (refImage, tgtImage, mosaicView,
            scale, difArray, bgDif, x0, y0, x1, y1, channel){
                
        if (x0 >= x1 || y0 >= y1)
            return;
        
        const self = this;
        
        /**
         * Create row from reference and target row, applying scale, gradient and taper.
         * If only creating a corrected target image, the reference row must only contain zeros.
         * @param {Number} coord X or Y coordinate of current row
         * @param {Number} taperEnd X or Y coordinate of taper end (edge of join)
         * @param {Float64Array} refSamples Row used to read reference samples, or zeros if not creating mosaic
         * @param {Float64Array} tgtSamples Row used to read target samples
         * @param {Float64Array} samples Output stored in this row
         * @param {Rect} row Work on pixels within this rectangle
         * @param {Number[]} difArray Difference between reference and target image
         * along a horizontal or vertical line, valid at the join edge
         * @param {Number[]} bgDif Difference between reference and target image
         * along a horizontal or vertical line, valid after taper has finished
         * @param {Number} difArrayStart The difArray index corresponding to row start
         */
        let apply = function(coord, taperEnd, refSamples, tgtSamples, samples, 
                row, difArray, bgDif, difArrayStart){
            tgtImage.getSamples(tgtSamples, row, channel);
            if (self.createMosaic){
                refImage.getSamples(refSamples, row, channel);
            }
            for (let i = 0; i < samples.length; i++) {
                if (tgtSamples[i]){
                    // tgt sample exists. We only taper tgt samples
                    const idx = difArrayStart + i;
                    const bg = bgDif[idx];
                    const delta = difArray[idx] - bg;
                    let fraction = 1 - (taperEnd - coord) / self.taperLength;
                    const taper = bg + delta * fraction;
                    samples[i] = tgtSamples[i] * scale - taper;
                } else {
                    // No tgt sample. Use ref (which may be zero or non zero)
                    samples[i] = refSamples[i];
                }
            }
            mosaicView.image.setSamples(samples, row, channel);
        };
        
        console.write("Processing taper [",channel,"]");
        if (this.isHorizontal) {
            let taperEnd = y1 - 1;
            let row = new Rect(x0, y0, x1, y0 + 1);
            let refSamples = new Float64Array(row.area);
            let tgtSamples = new Float64Array(row.area);
            let samples = new Float64Array(row.area);
            let difArrayStart = x0;
            let lastRow = y1 - y0 - 1;
            for (let y = y0; y < y1; y++) {
                row.moveTo(x0, y);
                apply(y, taperEnd, refSamples, tgtSamples, samples, row, difArray, bgDif, difArrayStart);
                progressCallback(y - y0, lastRow);
            }
        } else {
            let taperEnd = x1 - 1;
            let row = new Rect(x0, y0, x0 + 1, y1);
            let refSamples = new Float64Array(row.area);
            let tgtSamples = new Float64Array(row.area);
            let samples = new Float64Array(row.area);
            let difArrayStart = y0;
            let lastRow = x1 - x0 - 1;
            for (let x = x0; x < x1; x++) {
                row.moveTo(x, y0);
                apply(x, taperEnd, refSamples, tgtSamples, samples, row, difArray, bgDif, difArrayStart);
                progressCallback(x - x0, lastRow);
            }
        }
        console.writeln();
    };
    
}

/**
 * Calculates maximum and minimum values for the sample points
 * @param {SamplePairs[]} colorSamplePairs Contains samplePairArray
 * @param {SurfaceSpline[]} initialCorrections For each color, apply to
 * data points before calculating min max
 * @returns {SamplePairDifMinMax}
 */
function SamplePairDifMinMax(colorSamplePairs, initialCorrections) {
    this.minDif = Number.POSITIVE_INFINITY;
    this.maxDif = Number.NEGATIVE_INFINITY;
    for (let c=0; c<colorSamplePairs.length; c++) {
        let samplePairs = colorSamplePairs[c];
        for (let samplePair of samplePairs.samplePairArray) {
            let dif = samplePair.targetMedian - samplePair.referenceMedian;
            if (initialCorrections !== null) {
                let p = samplePair.rect.center;
                dif -= initialCorrections[c].evaluate(p);
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
 * @param {SurfaceSpline[]} initialCorrections If not null, apply this initial correction
 * before displaying lines and points
 * @param {SurfaceSpline[]} surfaceSplines Difference between reference and target images
 * @param {Rect} sampleRect Outside this area, hold difArray constant 
 * @param {SamplePairs[]} colorSamplePairs The SamplePair points to be displayed (array contains color channels)
 * @param {PhotometricMosaicData} data User settings used to create FITS header
 * @returns {undefined}
 */
function displayGradientGraph(targetView, referenceView, width, isHorizontal, 
        initialCorrections, surfaceSplines, sampleRect, colorSamplePairs, data){
    
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
            keywords.push(new FITSKeyword("COMMENT", "", "Propagate Smoothness: " + data.propagateSmoothness));
        } else if (data.viewFlag === DISPLAY_GRADIENT_TAPER_GRAPH()){
            if (data.gradientFlag){
                keywords.push(new FITSKeyword("COMMENT", "", "Propagate Smoothness: " + data.propagateSmoothness));
            }
            keywords.push(new FITSKeyword("COMMENT", "", "Taper Smoothness: " + data.taperSmoothness));
            keywords.push(new FITSKeyword("COMMENT", "", "Taper Length: " + data.taperLength));
        }
        
        graphWindow.keywords = keywords;
        view.endProcess();
    };
    
    /**
     * Create a difference array for a line either at the top or bottom of the 
     * sample bounding box. This dif array is used to draw lines on the graph.
     * If the initialCorrection SurfaceSpline is not null, this correction is 
     * subtracted from the difArray. The returned difArray then contains the 
     * residual correction instead of the full correction.
     * @param {SurfaceSpline} initialCorrection If not null, this is subtracted from the dif array
     * @param {SurfaceSpline} surfaceSpline Used to create the difArray
     * @param {Rect} sampleRect Outside this rectangle, hold the difArray value constant.
     * @param {Number} maxCoordinate Length of difArray (width or height of image)
     * @param {Boolean} isHorizontal Join direction
     * @param {Boolean} isTop Determines which side of the join is used to create the difArray 
     * @returns {Number[]} difArray
     */
    let getDifArray = function(initialCorrection, surfaceSpline, sampleRect, maxCoordinate, isHorizontal, isTop){
        let difArray;
        let initialDif = null;
        if (isHorizontal){
            let y = isTop ? sampleRect.y0 : sampleRect.y1;
            let minX = sampleRect.x0;
            let maxX = sampleRect.x1;
            difArray = createDifArrayX(surfaceSpline, y, minX, maxX, maxCoordinate);
            if (initialCorrection){
                initialDif = createDifArrayX(initialCorrection, y, minX, maxX, maxCoordinate);
            }
        } else {
            let x = isTop ? sampleRect.x0 : sampleRect.x1;
            let minY = sampleRect.y0;
            let maxY = sampleRect.y1;
            difArray = createDifArrayY(surfaceSpline, x, minY, maxY, maxCoordinate);
            if (initialCorrection){
                initialDif = createDifArrayY(initialCorrection, x, minY, maxY, maxCoordinate);
            }
        }
        if (initialDif){
            for (let i = 0; i < maxCoordinate; i++){
                difArray[i] -= initialDif[i];
            }
        }
        return difArray;
    };
    
    /**
     * Draw gradient line and sample points for a single color channel.
     * @param {Graph} graph
     * @param {Boolean} isHorizontal
     * @param {SurfaceSpline} initialCorrection If not null, apply this to data points before displaying 
     * @param {Number[]} difArrayTop DifArray at 'top' of sample rectangle
     * @param {Number[]} difArrayBottom DifArray at 'bottom' of sample rectangle
     * @param {Number} lineColor
     * @param {SamplePairs} samplePairs
     * @param {Number} pointColor
     * @returns {undefined}
     */
    let drawLineAndPoints = function(graph, isHorizontal, initialCorrection,
            difArrayTop, difArrayBottom, lineColor, samplePairs, pointColor) {
                
        for (let samplePair of samplePairs.samplePairArray) {
            // Draw the sample points
            let coord = isHorizontal ? samplePair.rect.center.x : samplePair.rect.center.y;
            let dif = samplePair.targetMedian - samplePair.referenceMedian;
            if (initialCorrection){
                dif -= initialCorrection.evaluate(samplePair.rect.center);
            }
            graph.drawPoint(coord, dif, pointColor);
        }
        graph.drawDifArray(difArrayTop, lineColor, true);
        graph.drawDifArray(difArrayBottom, lineColor, true);
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
    let minMax = new SamplePairDifMinMax(colorSamplePairs, initialCorrections);
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
        let initialCorrection = initialCorrections !== null ? initialCorrections[0] : null;
        let difArrayTop = getDifArray(initialCorrection, surfaceSplines[0], sampleRect, maxCoordinate, isHorizontal, true);
        let difArrayBottom = getDifArray(initialCorrection, surfaceSplines[0], sampleRect, maxCoordinate, isHorizontal, false);
        drawLineAndPoints(graphWithAxis, isHorizontal, initialCorrection,
            difArrayTop, difArrayBottom, 0xFFFF0000, colorSamplePairs[0], 0xFFFFFFFF);
    } else {
        // Color. Need to create 3 graphs for r, g, b and then merge them (binary OR) so that
        // if three samples are on the same pixel we get white and not the last color drawn
        let lineColors = [0xFFFF0000, 0xFF00FF00, 0xFF0000FF]; // r, g, b
        let pointColors = [0xFFCC0000, 0xFF00CC00, 0xFF0000CC]; // r, g, b
        for (let c = 0; c < colorSamplePairs.length; c++){
            let initialCorrection = initialCorrections !== null ? initialCorrections[c] : null;
            let difArrayTop = getDifArray(initialCorrection, surfaceSplines[c], sampleRect, maxCoordinate, isHorizontal, true);
            let difArrayBottom = getDifArray(initialCorrection, surfaceSplines[c], sampleRect, maxCoordinate, isHorizontal, false);
            let graphAreaOnly = graphWithAxis.createGraphAreaOnly();
            drawLineAndPoints(graphAreaOnly, isHorizontal, initialCorrection,
                difArrayTop, difArrayBottom, lineColors[c], colorSamplePairs[c], pointColors[c]);
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
