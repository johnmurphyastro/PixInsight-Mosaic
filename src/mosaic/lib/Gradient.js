/* global UndoFlag_NoSwapFile, GraphDialog, StdButton_Yes, OVERLAY_REF, OVERLAY_TGT, OVERLAY_RND, OVERLAY_AVG, StdIcon_Error, StdButton_Ok */

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

#define OVERLAY_REF 1
#define OVERLAY_TGT 2
#define OVERLAY_RND 3
#define OVERLAY_AVG 4

/**
 * Create difference array for the horizontal line at y from minX to maxX
 * @param {SurfaceSpline} surfaceSpline
 * @param {Number} y Specifies the horizontal line
 * @param {Number} minX calculate difference from minX
 * @param {Number} maxX calculate difference until maxX
 * @returns {Number[]} Difference array from minX to maxX - 1
 */
function createSplineArrayX(surfaceSpline, y, minX, maxX){
    let points = new Array(maxX - minX);
    for (let x = minX; x<maxX; x++){
        points[x - minX] = new Point(x, y);
    }
    return (surfaceSpline.evaluate(points)).toArray();
}

/**
 * Create difference array for the vertical line at x from minY to maxY
 * @param {SurfaceSpline} surfaceSpline
 * @param {Number} x Specifies the vertical line
 * @param {Number} minY calculate difference from minY
 * @param {Number} maxY calculate difference until maxY
 * @returns {Number[]} Difference array from minY to maxY - 1
 */
function createSplineArrayY(surfaceSpline, x, minY, maxY){
    let points = new Array(maxY - minY);
    for (let y = minY; y<maxY; y++){
        points[y - minY] = new Point(x, y);
    }
    return (surfaceSpline.evaluate(points)).toArray();
}

/**
 * Extend a dif array to cover either full image width or height.
 * Between minCoord and maxCoord, the difference is supplied from splineArray.
 * Outside this range, the values at minCoord and maxCoord are propogated to the array ends.
 * @param {Number[]} splineArray Difference array.
 * @param {Number} minCoord Hold difference constant until minCoord
 * @param {Number} maxCoord Hold difference constant after maxCoord
 * @param {Number} maxIndex Length of dif array (width or height of image)
 * @returns {Number[]} Difference array
 */
function extendDifArray(splineArray, minCoord, maxCoord, maxIndex){
    // calculate the difArray between minCoord and maxCoord
    // x can be x or y
    // From 0 to minCoord, set value to that at minCoord
    let startValue = splineArray[0];
    let startArray = new Array(minCoord);
    for (let x = 0; x < minCoord; x++){
        startArray[x] = startValue;
    }
    
    // Create difArray from 0 to maxY
    let difArray = startArray.concat(splineArray);
    
    // From maxY to end, set value to the value at maxY
    let endValue = splineArray[splineArray.length - 1];
    for (let x = maxCoord; x < maxIndex; x++){
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
 * @param {SamplePairs} samplePairs median values from ref and tgt samples
 * @param {Number} logSmoothing Logrithmic value; larger values smooth more
 * @returns {SurfaceSpline}
 */
function calcSurfaceSpline(samplePairs, logSmoothing){
    let samplePairArray = samplePairs.samplePairArray;
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
 * @param {Rect} overlapBox Bounding box of overlap region
 * @param {Rect} joinRect The specified join area (preview extended along join to overlapBox)
 * @param {Boolean} isHorizontal If true, the join is horizontal (one image is above the other)
 * @param {PhotometricMosaicData} data 
 * @param {Boolean} isTargetAfterRef True if target image is below or right of reference image
 * @returns {ScaleAndGradientApplier}
 */
function ScaleAndGradientApplier(imageWidth, imageHeight, overlapBox, joinRect, isHorizontal, 
        data, isTargetAfterRef) {
    this.imageWidth = imageWidth;
    this.imageHeight = imageHeight;
    this.createMosaic = data.createMosaicFlag;
    this.overlapBox = overlapBox;
    this.joinRect = joinRect;
    this.taperLength = data.taperLength;
    this.isTargetAfterRef = isTargetAfterRef;
    this.isHorizontal = isHorizontal;
    if (isHorizontal){
        this.firstTaperStart = Math.max(0, overlapBox.y0 - this.taperLength); // overlapStart - taperLength
        this.overlapStart = overlapBox.y0;
        this.joinStart = joinRect.y0;
        this.joinEnd = joinRect.y1;
        this.overlapEnd = overlapBox.y1;
        this.secondTaperEnd = Math.min(imageHeight, overlapBox.y1 + this.taperLength); // overlapEnd + taperLength
    } else {
        this.firstTaperStart = Math.max(0, overlapBox.x0 - this.taperLength);
        this.overlapStart = overlapBox.x0;
        this.joinStart = joinRect.x0;
        this.joinEnd = joinRect.x1;
        this.overlapEnd = overlapBox.x1;
        this.secondTaperEnd = Math.min(imageWidth, overlapBox.x1 + this.taperLength);
    }
    this.joinType = 0;
    if (data.mosaicOverlayRefFlag){
        this.joinType = OVERLAY_REF;
    } else if (data.mosaicOverlayTgtFlag){
        this.joinType = OVERLAY_TGT;
    } else if (data.mosaicRandomFlag){
        this.joinType = OVERLAY_RND;
    } else if (data.mosaicAverageFlag){
        this.joinType = OVERLAY_AVG;
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
     * @param {SurfaceSpline} joinSurfaceSpline
     * @param {Rect} tgtBox Target image bounding box
     * @param {Number} channel
     * @returns {undefined}
     */
    this.applyAllCorrections = function (refImage, tgtImage, view, scale,
            propagateSurfaceSpline, joinSurfaceSpline, tgtBox, channel){
                
        processEvents();
        if (this.isTargetAfterRef === null){
            // Insert mode
            // Full correction from start of join up to end of the join region
            this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                    this.joinRect.x0, this.joinRect.y0, this.joinRect.x1, this.joinRect.y1, 
                    channel, this.joinType);
            return;
        }
        
        let fullDifBeforeOverlap;
        let fullDifAfterOverlap;
        let bgDifBeforeOverlap;
        let bgDifAfterOverlap;
        let length;
        
        if (this.isHorizontal){
            let minX = this.overlapBox.x0;
            let maxX = this.overlapBox.x1;
            length = this.imageWidth;
            let splineArray1 = createSplineArrayX(joinSurfaceSpline, this.overlapStart, minX, maxX);
            fullDifBeforeOverlap = extendDifArray(splineArray1, minX, maxX, length);
            let splineArray2 = createSplineArrayX(joinSurfaceSpline, this.overlapEnd, minX, maxX);
            fullDifAfterOverlap = extendDifArray(splineArray2, minX, maxX, length);
            if (propagateSurfaceSpline !== null){
                if (this.isTargetAfterRef){
                    let splineArrayPropagate2 = createSplineArrayX(propagateSurfaceSpline, this.overlapEnd, minX, maxX);
                    bgDifAfterOverlap = extendDifArray(splineArrayPropagate2, minX, maxX, length);
                } else {
                    let splineArrayPropagate1 = createSplineArrayX(propagateSurfaceSpline, this.overlapStart, minX, maxX);
                    bgDifBeforeOverlap = extendDifArray(splineArrayPropagate1, minX, maxX, length);
                }     
            }
        } else {
            let minY = this.overlapBox.y0;
            let maxY = this.overlapBox.y1;
            length = this.imageHeight;
            let splineArray1 = createSplineArrayY(joinSurfaceSpline, this.overlapStart, minY, maxY);
            fullDifBeforeOverlap = extendDifArray(splineArray1, minY, maxY, length);
            let splineArray2 = createSplineArrayY(joinSurfaceSpline, this.overlapEnd, minY, maxY);
            fullDifAfterOverlap = extendDifArray(splineArray2, minY, maxY, length);
            if (propagateSurfaceSpline !== null){
                if (this.isTargetAfterRef){
                    let splineArrayPropagate2 = createSplineArrayY(propagateSurfaceSpline, this.overlapEnd, minY, maxY);
                    bgDifAfterOverlap = extendDifArray(splineArrayPropagate2, minY, maxY, length);
                } else {
                    let splineArrayPropagate1 = createSplineArrayY(propagateSurfaceSpline, this.overlapStart, minY, maxY);
                    bgDifBeforeOverlap = extendDifArray(splineArrayPropagate1, minY, maxY, length);
                }
            }
        }
         
        if (propagateSurfaceSpline === null){
            if (this.isTargetAfterRef){
                bgDifAfterOverlap = createAvgDifArray(fullDifAfterOverlap);
            } else {
                bgDifBeforeOverlap = createAvgDifArray(fullDifBeforeOverlap);
            }
        }
       
        if (this.isHorizontal) {
            if (this.isTargetAfterRef) {
                // Reference side of join
                // Full correction from start of target up to start of the join region
                this.applyScaleAndGradient(refImage, tgtImage, view, scale, fullDifBeforeOverlap,
                        tgtBox.x0, tgtBox.y0, tgtBox.x1, this.overlapStart, channel, false);

                // Overlap region before join. Reference side so reference overlay
                this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                        tgtBox.x0, this.overlapStart, tgtBox.x1, this.joinStart, channel, OVERLAY_REF);

                // Full correction from start of join up to end of the join region
                this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                        tgtBox.x0, this.joinStart, tgtBox.x1, this.joinEnd, channel, this.joinType);
                        
                // Overlap region after join. Target side so target overlay
                this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                        tgtBox.x0, this.joinEnd, tgtBox.x1, this.overlapEnd, channel, OVERLAY_TGT);

                // Taper down region. Apply full scale correction but 
                // gradually reduce the gradient correction
                this.applyScaleAndGradientTaperDown(refImage, tgtImage, view, scale, fullDifAfterOverlap, bgDifAfterOverlap,
                        tgtBox.x0, this.overlapEnd, tgtBox.x1, this.secondTaperEnd, channel);

                // Target side of join
                // If taper: Taper has finished. Only apply scale and average offset
                // No taper: bgDif === fullDif. Apply full correction.
                this.applyScaleAndGradient(refImage, tgtImage, view, scale, bgDifAfterOverlap,
                        tgtBox.x0, this.secondTaperEnd, tgtBox.x1, tgtBox.y1, channel, true);
            } else {
                // Target side of join
                // If taper: Taper has not yet started. Only apply scale and average offset
                // No taper: bgDif === fullDif. Apply full correction.
                this.applyScaleAndGradient(refImage, tgtImage, view, scale, bgDifBeforeOverlap,
                        tgtBox.x0, tgtBox.y0, tgtBox.x1, this.firstTaperStart, channel, true);

                // Taper up region. Apply full scale correction and 
                // gradually increase the gradient correction from zero to full
                this.applyScaleAndGradientTaperUp(refImage, tgtImage, view, scale, fullDifBeforeOverlap, bgDifBeforeOverlap,
                        tgtBox.x0, this.firstTaperStart, tgtBox.x1, this.overlapStart, channel);

                // Overlap region before join. Target side so target overlay
                this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                        tgtBox.x0, this.overlapStart, tgtBox.x1, this.joinStart, channel, OVERLAY_TGT);
                        
                // Full correction from start of the join region to the end of join region 
                this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                        tgtBox.x0, this.joinStart, tgtBox.x1, this.joinEnd, channel, this.joinType);
                
                // Overlap region after join. Reference side so reference overlay
                this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                        tgtBox.x0, this.joinEnd, tgtBox.x1, this.overlapEnd, channel, OVERLAY_REF);

                // Reference side of join
                // Full correction from end of the join region to the end of the target image 
                this.applyScaleAndGradient(refImage, tgtImage, view, scale, fullDifAfterOverlap,
                        tgtBox.x0, this.overlapEnd, tgtBox.x1, tgtBox.y1, channel, false);
            }
        } else {    // vertical join
            if (isTargetAfterRef) {
                // Reference side of join
                // Full correction from start of target up to start of the join region
                this.applyScaleAndGradient(refImage, tgtImage, view, scale, fullDifBeforeOverlap,
                        tgtBox.x0, tgtBox.y0, this.overlapStart, tgtBox.y1, channel, false);

                // Overlap region before join. Reference side so reference overlay
                this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                        this.overlapStart, tgtBox.y0, this.joinStart, tgtBox.y1, channel, OVERLAY_REF);
                
                // Full correction from start of join up to end of the join region
                this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                        this.joinStart, tgtBox.y0, this.joinEnd, tgtBox.y1, channel, this.joinType);

                // Overlap region after join. Target side so target overlay
                this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                        this.joinEnd, tgtBox.y0, this.overlapEnd, tgtBox.y1, channel, OVERLAY_TGT);
                
                // Taper down region. Apply full scale correction but 
                // gradually reduce the gradient correction
                this.applyScaleAndGradientTaperDown(refImage, tgtImage, view, scale, fullDifAfterOverlap, bgDifAfterOverlap,
                        this.overlapEnd, tgtBox.y0, this.secondTaperEnd, tgtBox.y1, channel);
                
                // Target side of join
                // If taper: Taper has finished. Only apply scale and average offset
                // No taper: bgDif === fullDif. Apply full correction.
                this.applyScaleAndGradient(refImage, tgtImage, view, scale, bgDifAfterOverlap,
                        this.secondTaperEnd, tgtBox.y0, tgtBox.x1, tgtBox.y1, channel, true);
            } else {
                // Target side of join
                // If taper: Taper has not yet started. Only apply scale and average offset
                // No taper: bgDif === fullDif. Apply full correction.
                this.applyScaleAndGradient(refImage, tgtImage, view, scale, bgDifBeforeOverlap,
                        tgtBox.x0, tgtBox.y0, this.firstTaperStart, tgtBox.y1, channel, true);

                // Taper down region. Apply full scale correction but 
                // gradually reduce the gradient correction
                this.applyScaleAndGradientTaperUp(refImage, tgtImage, view, scale, fullDifBeforeOverlap, bgDifBeforeOverlap,
                        this.firstTaperStart, tgtBox.y0, this.overlapStart, tgtBox.y1, channel);
                
                // Overlap region before join. Target side so target overlay
                this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                        this.overlapStart, tgtBox.y0, this.joinStart, tgtBox.y1, channel, OVERLAY_TGT);
                
                // Full correction from start of the join region to the end of join 
                this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                        this.joinStart, tgtBox.y0, this.joinEnd, tgtBox.y1, channel, this.joinType);

                // Overlap region after join. Reference side so reference overlay
                this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                        this.joinEnd, tgtBox.y0, this.overlapEnd, tgtBox.y1, channel, OVERLAY_REF);
                        
                // Reference side of join
                // Full correction from end of the join region to the end of the target image 
                this.applyScaleAndGradient(refImage, tgtImage, view, scale, fullDifAfterOverlap,
                        this.overlapEnd, tgtBox.y0, tgtBox.x1, tgtBox.y1, channel, false);
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
     * @param {Number} joinType OVERLAY_REF, OVERLAY_TGT, OVERLAY_RND or OVERLAY_AVG
     */
    this.applyScaleAndGradientToJoin = function (refImage, tgtImage, mosaicView,
            scale, surfaceSpline, x0, y0, x1, y1, channel, joinType){
                
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
                switch (joinType){
                    case OVERLAY_RND:
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
                        break;
                    case OVERLAY_REF:
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
                        break;
                    case OVERLAY_TGT:
                        if (tgtSamples[i]){
                            // tgt exists
                            samples[i] = tgtSamples[i] * scale;
                            surfaceSplinePoints.addPoint(i, x, y); // offset removed later
                        } else {
                            // tgt did not exist. Use ref (which may be zero or non zero)
                            samples[i] = refSamples[i];
                        }
                        break;
                    case OVERLAY_AVG:
                        if (tgtSamples[i]){
                            // tgt exists
                            samples[i] = tgtSamples[i] * scale;
                            surfaceSplinePoints.addPoint(i, x, y); // offset removed later
                        } else {
                            // tgt does not exist. Use ref (which may be zero or non zero)
                            samples[i] = refSamples[i];
                        }
                        break;
                    default:
                        console.criticalln("Unknown join type: " + joinType);
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
 * @returns {SamplePairDifMinMax}
 */
function SamplePairDifMinMax(colorSamplePairs) {
    this.minDif = Number.POSITIVE_INFINITY;
    this.maxDif = Number.NEGATIVE_INFINITY;
    for (let c=0; c<colorSamplePairs.length; c++) {
        let samplePairs = colorSamplePairs[c];
        for (let samplePair of samplePairs.samplePairArray) {
            let dif = samplePair.targetMedian - samplePair.referenceMedian;
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
 * @param {Boolean} isTargetAfterRef true if target is below reference or target is right of reference 
 * @param {SurfaceSpline[]} surfaceSplines Difference between reference and target images
 * @param {Rect} sampleRect Create dif arrays at either side of this rectangle 
 * @param {SamplePairs[]} colorSamplePairs The SamplePair points to be displayed (array contains color channels)
 * @param {PhotometricMosaicData} data User settings used to create FITS header
 * @param {Boolean} isPropagateGraph If true, display single line for target side of overlap bounding box
 * @returns {undefined}
 */
function displayGradientGraph(targetView, referenceView, width, isHorizontal, 
        isTargetAfterRef, surfaceSplines, sampleRect, colorSamplePairs, data,
        isPropagateGraph){
    
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
        if (data.viewFlag === DISPLAY_PROPAGATE_GRAPH()){
            keywords.push(new FITSKeyword("COMMENT", "", "Propagate Smoothness: " + data.propagateSmoothness));
        } else if (data.viewFlag === DISPLAY_GRADIENT_GRAPH()){
            keywords.push(new FITSKeyword("COMMENT", "", "Taper Smoothness: " + data.gradientSmoothness));
            keywords.push(new FITSKeyword("COMMENT", "", "Taper Length: " + data.taperLength));
        }
        
        graphWindow.keywords = keywords;
        view.endProcess();
    };
    
    /**
     * Draw gradient line and sample points for a single color channel.
     * @param {Graph} graph
     * @param {Boolean} isHorizontal
     * @param {Number[][]} difArrays Array of DifArray to draw
     * @param {Number} lineBoldColor
     * @param {GraphLinePath} line Specifies which line should be bold
     * @param {Number} lineColor
     * @param {SamplePairs} samplePairs
     * @param {Number} pointColor
     * @returns {undefined}
     */
    let drawLineAndPoints = function(graph, isHorizontal,
            difArrays, lineBoldColor, graphLinePath, lineColor, samplePairs, pointColor) {
                
        for (let samplePair of samplePairs.samplePairArray) {
            // Draw the sample points
            let coord = isHorizontal ? samplePair.rect.center.x : samplePair.rect.center.y;
            let dif = samplePair.targetMedian - samplePair.referenceMedian;
            graph.drawPoint(coord, dif, pointColor);
        }
        for (let i = 0; i < difArrays.length; i++){
            let difArray = difArrays[i];
            let path = graphLinePath.paths[i];
            let firstCoord = isHorizontal ? path[0].x : path[0].y;
            if (graphLinePath.bold[i]){
                graph.drawDifArray(difArray, firstCoord, lineBoldColor, true);
            } else {
                graph.drawDifArray(difArray, firstCoord, lineColor, false);
            }
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
    const minScaleDif = 1e-4;
    let minMax = new SamplePairDifMinMax(colorSamplePairs);
    let maxY = minMax.maxDif;
    let minY = minMax.minDif;
    if (maxY - minY < minScaleDif){
        maxY += minScaleDif / 2;
        minY -= minScaleDif / 2;
    }
    let graphWithAxis = new Graph(0, minY, maxCoordinate, maxY);
    graphWithAxis.setAxisLength(axisWidth + 2, 720);
    graphWithAxis.createGraph(xLabel, yLabel);
    
    let graphLine = new GraphLinePath();
    if (isPropagateGraph){
        graphLine.initPropagatePath(data.cache.overlap, isHorizontal, isTargetAfterRef);
    } else {
        graphLine.initGradientPaths(data.cache.overlap, sampleRect, isHorizontal, isTargetAfterRef, data);
    }
    
    if (colorSamplePairs.length === 1){ // B&W
        let difArrays = [];
        for (let path of graphLine.paths){
            difArrays.push(surfaceSplines[0].evaluate(path).toArray());
        }
        drawLineAndPoints(graphWithAxis, isHorizontal,
            difArrays, 0xFFFF0000, graphLine, 0xFF990000, colorSamplePairs[0], 0xFFFFFFFF); // TODO
    } else {
        // Color. Need to create 3 graphs for r, g, b and then merge them (binary OR) so that
        // if three samples are on the same pixel we get white and not the last color drawn
        let lineBoldColors = [0xFFFF0000, 0xFF00FF00, 0xFF0000FF]; // r, g, b
        let lineColors = [0xFF990000, 0xFF009900, 0xFF000099]; // r, g, b
        let pointColors = [0xFFCC0000, 0xFF00CC00, 0xFF0000CC]; // r, g, b
        for (let c = 0; c < colorSamplePairs.length; c++){
            let difArrays = [];
            for (let path of graphLine.paths){
                difArrays.push(surfaceSplines[c].evaluate(path).toArray());
            }
            let graphAreaOnly = graphWithAxis.createGraphAreaOnly();
            drawLineAndPoints(graphAreaOnly, isHorizontal,
                difArrays, lineBoldColors[c], graphLine, lineColors[c], colorSamplePairs[c], pointColors[c]);
            graphWithAxis.mergeWithGraphAreaOnly(graphAreaOnly);
        }
    }
    // Display graph in script dialog
    GraphDialog.prototype = new Dialog;
    let graph = new GraphDialog(graphWithAxis.bitmap, "Gradient Graph", graphWithAxis.screenToWorld);
    if (graph.execute() === StdButton_Yes){
        // User requested graph saved to PixInsight View
        let windowTitle = WINDOW_ID_PREFIX() + targetView.fullId + "__Gradient";
        let imageWindow = graphWithAxis.createWindow(windowTitle, true);
        gradientGraphFitsHeader(referenceView, targetView, imageWindow, data);
        imageWindow.show();
    }
}


function GraphLinePath(){
    /** {Point[][]} paths min, mid and max paths across overlap region */
    this.paths = [];
    /** {Boolean} bold Draw nth line bold */
    this.bold = [];
    
    /**
    * 
    * @param {Overlap} overlap
    * @param {Rect} joinRect
    * @param {Boolean} isHorizontal
    * @param {Boolean} isTargetAfterRef
    * @param {PhotometricMosaicData} data
    * @returns {GraphLinePath}
    */
    this.initGradientPaths = function (overlap, joinRect, isHorizontal, isTargetAfterRef, data){
        let minPath;
        let midPath;
        let maxPath;
        if (isHorizontal){
            let joinStart = joinRect.y0;
            let joinEnd = joinRect.y1;
            minPath = overlap.getMinOutlineAtXArray(joinStart);
            maxPath = overlap.getMaxOutlineAtXArray(joinEnd);
            midPath = overlap.getMidOutlineAtXArray(minPath, maxPath);
        } else {
            let joinStart = joinRect.x0;
            let joinEnd = joinRect.x1;
            minPath = overlap.getMinOutlineAtYArray(joinStart);
            maxPath = overlap.getMaxOutlineAtYArray(joinEnd);
            midPath = overlap.getMidOutlineAtYArray(minPath, maxPath);
        }

        this.paths.push(minPath);
        this.paths.push(midPath);
        this.paths.push(maxPath);

        this.bold = new Array(this.paths.length);
        if (data.mosaicAverageFlag || data.mosaicRandomFlag || isTargetAfterRef === null){
            // Draw all lines bold for average, random and insert modes
            for (let i=0; i<this.paths.length; i++){
                this.bold[i] = true;
            }
        } else if (data.mosaicOverlayTgtFlag && isTargetAfterRef ||
                data.mosaicOverlayRefFlag && !isTargetAfterRef){
            // First line bold
            for (let i=0; i<this.paths.length; i++){
                this.bold[i] = (i === 0);
            }
        } else {
            for (let i=0; i<this.paths.length; i++){
                this.bold[i] = (i === this.paths.length - 1);
            }
        }
    };
    
    /**
     * Create a straight line path that follows a side of the overlap bounding box
     * @param {Overlap} overlap
     * @param {Boolean} isHorizontal
     * @param {Boolean} isTargetAfterRef
     */
    this.initPropagatePath = function (overlap, isHorizontal, isTargetAfterRef){
        let overlapBox = overlap.overlapBox;
        let points;
        
        if (isTargetAfterRef){
            // Propagate region is after join
            if (isHorizontal){
                let minX = overlapBox.x0;
                let maxX = overlapBox.x1;
                points = new Array(maxX - minX);
                for (let x = minX; x<maxX; x++){
                    // Below join
                    points[x - minX] = new Point(x, overlapBox.y1);
                }
            } else {
                let minY = overlapBox.y0;
                let maxY = overlapBox.y1;
                points = new Array(maxY - minY);
                for (let y = minY; y<maxY; y++){
                    // Right of join
                    points[y - minY] = new Point(overlapBox.x1, y);
                }
            }
        } else {
            // Propagate region is before join
            if (isHorizontal){
                let minX = overlapBox.x0;
                let maxX = overlapBox.x1;
                points = new Array(maxX - minX);
                for (let x = minX; x<maxX; x++){
                    // Above join
                    points[x - minX] = new Point(x, overlapBox.y0);
                }
            } else {
                let minY = overlapBox.y0;
                let maxY = overlapBox.y1;
                points = new Array(maxY - minY);
                for (let y = minY; y<maxY; y++){
                    // Left of join
                    points[y - minY] = new Point(overlapBox.x0, y);
                }
            }
        }
        
        this.paths.push(points);
        this.bold.push(true);
    };
}
