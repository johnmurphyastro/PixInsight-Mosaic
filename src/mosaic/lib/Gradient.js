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
 * @param {SamplePair[]} samplePairs median values from ref and tgt samples
 * @param {Number} logSmoothing Logrithmic value; larger values smooth more
 * @returns {SurfaceSpline}
 */
function calcSurfaceSpline(samplePairs, logSmoothing){
    const length = samplePairs.length;
    let xVector = new Vector(length);
    let yVector = new Vector(length);
    let zVector = new Vector(length);
    let wVector = new Vector(length);
    for (let i=0; i<length; i++){
        let samplePair = samplePairs[i];
        xVector.at(i, samplePair.rect.center.x);
        yVector.at(i, samplePair.rect.center.y);
        zVector.at(i, samplePair.getDifference());
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
 * @param {Overlap} overlap Represents the overlap region
 * @param {Rect} joinRect The specified join area (preview extended along join to overlapBox)
 * @param {Boolean} isHorizontal If true, the join is horizontal (one image is above the other)
 * @param {PhotometricMosaicData} data 
 * @param {Boolean} isTargetAfterRef True if target image is below or right of reference image
 * @returns {ScaleAndGradientApplier}
 */
function ScaleAndGradientApplier(imageWidth, imageHeight, overlap, joinRect, isHorizontal, 
        data, isTargetAfterRef) {
    let imageWidth_ = imageWidth;
    let imageHeight_ = imageHeight;
    let createMosaic_ = data.createMosaicFlag;
    let joinRect_ = joinRect;
    let isTargetAfterRef_ = isTargetAfterRef;
    let isHorizontal_ = isHorizontal;
    let isTargetAfterRef_ = isTargetAfterRef;
    let taperLength_ = data.taperLength;
    let firstTaperStart_;
    let overlapStart_;
    let joinStart_;
    let joinEnd_;
    let overlapEnd_;
    let secondTaperEnd_;
    let joinType_ = 0;
    
    if (isHorizontal){
        let overlapBox = overlap.overlapBox;
        firstTaperStart_ = Math.max(0, overlapBox.y0 - taperLength_); // overlapStart - taperLength
        overlapStart_ = overlapBox.y0;
        joinStart_ = joinRect.y0;
        joinEnd_ = joinRect.y1;
        overlapEnd_ = overlapBox.y1;
        secondTaperEnd_ = Math.min(imageHeight, overlapBox.y1 + taperLength_); // overlapEnd + taperLength
    } else {
        let overlapBox = overlap.overlapBox;
        firstTaperStart_ = Math.max(0, overlapBox.x0 - taperLength_);
        overlapStart_ = overlapBox.x0;
        joinStart_ = joinRect.x0;
        joinEnd_ = joinRect.x1;
        overlapEnd_ = overlapBox.x1;
        secondTaperEnd_ = Math.min(imageWidth, overlapBox.x1 + taperLength_);
    }
    
    if (data.mosaicOverlayRefFlag){
        joinType_ = OVERLAY_REF;
    } else if (data.mosaicOverlayTgtFlag){
        joinType_ = OVERLAY_TGT;
    } else if (data.mosaicRandomFlag){
        joinType_ = OVERLAY_RND;
    } else if (data.mosaicAverageFlag){
        joinType_ = OVERLAY_AVG;
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
     * Reads and writes image samples within the specified area
     * @param {Image} refImage
     * @param {Image} tgtImage
     * @param {View} outputView
     * @param {Number} channel
     * @param {Boolean} createMosaic
     * @param {Boolean} isHorizontal 
     * @returns {ScaleAndGradientApplier.applyAllCorrections.ImageSamples}
     */
    function ImageSamples(refImage, tgtImage, outputView, channel, createMosaic, isHorizontal){
        let refImage_ = refImage;
        let tgtImage_ = tgtImage;
        let outputView_ = outputView;
        let channel_ = channel;
        let createMosaic_ = createMosaic;
        let isHorizontal_ = isHorizontal;
        let rect_;
        let refSamples_;
        let tgtSamples_;
        let samples_;

        let start_;
        let end_;
        let nth_ = 0;
        let maxN_;

        this.setArea = function(x0, y0, x1, y1){
            if (isHorizontal_){
                rect_ = new Rect(x0, y0, x1, y0 + 1);
                start_ = y0;
                end_ = y1;
            } else {
                rect_ = new Rect(x0, y0, x0 + 1, y1);
                start_ = x0;
                end_ = x1;
            }
            let length = rect_.area;
            refSamples_ = new Float64Array(length);
            tgtSamples_ = new Float64Array(length);
            samples_ = new Float64Array(length);
            nth_ = 0;
            maxN_ = end_ - start_;
        };

        this.hasNext = function(){
            return nth_ < maxN_;
        };

        this.next = function(){
            if (isHorizontal_){
                rect_.moveTo(rect_.x0, start_ + nth_);
            } else {
                rect_.moveTo(start_ + nth_, rect_.y0);
            }
            progressCallback(nth_, maxN_ - 1);
            nth_++;
        };

        /**
         * @returns {Number} First X of current row or column
         */
        this.getX = function(){
            return rect_.x0;
        };
        /**
         * @returns {Number} First Y of current row or column
         */
        this.getY = function(){
            return rect_.y0;
        };
        /**
         * If creating a mosiac, returns the reference image samples.
         * Otherwise, returns a zero array.
         * Do not modify the returned array.
         * @returns {Float64Array} Reference samples or zero values
         */
        this.getRefSamples = function(){
            if (createMosaic_){
                refImage_.getSamples(refSamples_, rect_, channel_);
            }
            return refSamples_;
        };
        /**
         * @returns {Float64Array} Target samples. Do not modify.
         */
        this.getTgtSamples = function(){
            tgtImage_.getSamples(tgtSamples_, rect_, channel_);
            return tgtSamples_;
        };
        /**
         * Write the corrected samples to this buffer. All values in the array
         * must be set to avoid using previous values.
         * @returns {Float64Array} Write to this buffer! 
         */
        this.getOutputBuffer = function(){
            return samples_;
        };
        /**
         * Write the contents of the output buffer to the output image
         */
        this.write = function(){
            outputView_.image.setSamples(samples_, rect_, channel_);
        };
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
        if (isTargetAfterRef_ === null){
            // Insert mode
            // Full correction from start of join up to end of the join region
            this.applyScaleAndGradientToJoin(refImage, tgtImage, view, scale, joinSurfaceSpline,
                    joinRect_.x0, joinRect_.y0, joinRect_.x1, joinRect_.y1, 
                    channel, joinType_);
            return;
        }
        
        let fullDifBeforeOverlap;
        let fullDifAfterOverlap;
        let bgDifBeforeOverlap;
        let bgDifAfterOverlap;
        let length;
        
        if (isHorizontal_){
            let minX = joinRect_.x0;
            let maxX = joinRect_.x1;
            length = imageWidth_;
            let splineArray1 = createSplineArrayX(joinSurfaceSpline, overlapStart_, minX, maxX);
            fullDifBeforeOverlap = extendDifArray(splineArray1, minX, maxX, length);
            let splineArray2 = createSplineArrayX(joinSurfaceSpline, overlapEnd_, minX, maxX);
            fullDifAfterOverlap = extendDifArray(splineArray2, minX, maxX, length);
            if (propagateSurfaceSpline !== null){
                if (isTargetAfterRef_){
                    let splineArrayPropagate2 = createSplineArrayX(propagateSurfaceSpline, overlapEnd_, minX, maxX);
                    bgDifAfterOverlap = extendDifArray(splineArrayPropagate2, minX, maxX, length);
                } else {
                    let splineArrayPropagate1 = createSplineArrayX(propagateSurfaceSpline, overlapStart_, minX, maxX);
                    bgDifBeforeOverlap = extendDifArray(splineArrayPropagate1, minX, maxX, length);
                }     
            }
        } else {
            let minY = joinRect_.y0;
            let maxY = joinRect_.y1;
            length = imageHeight_;
            let splineArray1 = createSplineArrayY(joinSurfaceSpline, overlapStart_, minY, maxY);
            fullDifBeforeOverlap = extendDifArray(splineArray1, minY, maxY, length);
            let splineArray2 = createSplineArrayY(joinSurfaceSpline, overlapEnd_, minY, maxY);
            fullDifAfterOverlap = extendDifArray(splineArray2, minY, maxY, length);
            if (propagateSurfaceSpline !== null){
                if (isTargetAfterRef_){
                    let splineArrayPropagate2 = createSplineArrayY(propagateSurfaceSpline, overlapEnd_, minY, maxY);
                    bgDifAfterOverlap = extendDifArray(splineArrayPropagate2, minY, maxY, length);
                } else {
                    let splineArrayPropagate1 = createSplineArrayY(propagateSurfaceSpline, overlapStart_, minY, maxY);
                    bgDifBeforeOverlap = extendDifArray(splineArrayPropagate1, minY, maxY, length);
                }
            }
        }
         
        if (propagateSurfaceSpline === null){
            if (isTargetAfterRef_){
                bgDifAfterOverlap = createAvgDifArray(fullDifAfterOverlap);
            } else {
                bgDifBeforeOverlap = createAvgDifArray(fullDifBeforeOverlap);
            }
        }
        
        let imageSamples = new ImageSamples(refImage, tgtImage, view, channel, createMosaic_, isHorizontal_);
       
        if (isHorizontal_) {
            if (isTargetAfterRef_) {
                // Reference side of join
                // Full correction from start of target up to start of the join region
                applyScaleAndGradient(imageSamples, scale, fullDifBeforeOverlap,
                        tgtBox.x0, tgtBox.y0, tgtBox.x1, overlapStart_, false);

                // Overlap region before join. Reference side so reference overlay
                applyScaleAndGradientToJoin(imageSamples, scale, joinSurfaceSpline,
                        tgtBox.x0, overlapStart_, tgtBox.x1, joinStart_, OVERLAY_REF);

                // Full correction from start of join up to end of the join region
                applyScaleAndGradientToJoin(imageSamples, scale, joinSurfaceSpline,
                        tgtBox.x0, joinStart_, tgtBox.x1, joinEnd_, joinType_);
                        
                // Overlap region after join. Target side so target overlay
                applyScaleAndGradientToJoin(imageSamples, scale, joinSurfaceSpline,
                        tgtBox.x0, joinEnd_, tgtBox.x1, overlapEnd_, OVERLAY_TGT);

                // Taper down region. Apply full scale correction but 
                // gradually reduce the gradient correction
                applyScaleAndGradientTaperDown(imageSamples, scale, fullDifAfterOverlap, bgDifAfterOverlap,
                        tgtBox.x0, overlapEnd_, tgtBox.x1, secondTaperEnd_);

                // Target side of join
                // If taper: Taper has finished. Only apply scale and average offset
                // No taper: bgDif === fullDif. Apply full correction.
                applyScaleAndGradient(imageSamples, scale, bgDifAfterOverlap,
                        tgtBox.x0, secondTaperEnd_, tgtBox.x1, tgtBox.y1, true);
            } else {
                // Target side of join
                // If taper: Taper has not yet started. Only apply scale and average offset
                // No taper: bgDif === fullDif. Apply full correction.
                applyScaleAndGradient(imageSamples, scale, bgDifBeforeOverlap,
                        tgtBox.x0, tgtBox.y0, tgtBox.x1, firstTaperStart_, true);

                // Taper up region. Apply full scale correction and 
                // gradually increase the gradient correction from zero to full
                applyScaleAndGradientTaperUp(imageSamples, scale, fullDifBeforeOverlap, bgDifBeforeOverlap,
                        tgtBox.x0, firstTaperStart_, tgtBox.x1, overlapStart_);

                // Overlap region before join. Target side so target overlay
                applyScaleAndGradientToJoin(imageSamples, scale, joinSurfaceSpline,
                        tgtBox.x0, overlapStart_, tgtBox.x1, joinStart_, OVERLAY_TGT);
                        
                // Full correction from start of the join region to the end of join region 
                applyScaleAndGradientToJoin(imageSamples, scale, joinSurfaceSpline,
                        tgtBox.x0, joinStart_, tgtBox.x1, joinEnd_, joinType_);
                
                // Overlap region after join. Reference side so reference overlay
                applyScaleAndGradientToJoin(imageSamples, scale, joinSurfaceSpline,
                        tgtBox.x0, joinEnd_, tgtBox.x1, overlapEnd_, OVERLAY_REF);

                // Reference side of join
                // Full correction from end of the join region to the end of the target image 
                applyScaleAndGradient(imageSamples, scale, fullDifAfterOverlap,
                        tgtBox.x0, overlapEnd_, tgtBox.x1, tgtBox.y1, false);
            }
        } else {    // vertical join
            if (isTargetAfterRef_) {
                // Reference side of join
                // Full correction from start of target up to start of the join region
                applyScaleAndGradient(imageSamples, scale, fullDifBeforeOverlap,
                        tgtBox.x0, tgtBox.y0, overlapStart_, tgtBox.y1, false);

                // Overlap region before join. Reference side so reference overlay
                applyScaleAndGradientToJoin(imageSamples, scale, joinSurfaceSpline,
                        overlapStart_, tgtBox.y0, joinStart_, tgtBox.y1, OVERLAY_REF);
                
                // Full correction from start of join up to end of the join region
                applyScaleAndGradientToJoin(imageSamples, scale, joinSurfaceSpline,
                        joinStart_, tgtBox.y0, joinEnd_, tgtBox.y1, joinType_);

                // Overlap region after join. Target side so target overlay
                applyScaleAndGradientToJoin(imageSamples, scale, joinSurfaceSpline,
                        joinEnd_, tgtBox.y0, overlapEnd_, tgtBox.y1, OVERLAY_TGT);
                
                // Taper down region. Apply full scale correction but 
                // gradually reduce the gradient correction
                applyScaleAndGradientTaperDown(imageSamples, scale, fullDifAfterOverlap, bgDifAfterOverlap,
                        overlapEnd_, tgtBox.y0, secondTaperEnd_, tgtBox.y1);
                
                // Target side of join
                // If taper: Taper has finished. Only apply scale and average offset
                // No taper: bgDif === fullDif. Apply full correction.
                applyScaleAndGradient(imageSamples, scale, bgDifAfterOverlap,
                        secondTaperEnd_, tgtBox.y0, tgtBox.x1, tgtBox.y1, true);
            } else {
                // Target side of join
                // If taper: Taper has not yet started. Only apply scale and average offset
                // No taper: bgDif === fullDif. Apply full correction.
                applyScaleAndGradient(imageSamples, scale, bgDifBeforeOverlap,
                        tgtBox.x0, tgtBox.y0, firstTaperStart_, tgtBox.y1, true);

                // Taper down region. Apply full scale correction but 
                // gradually reduce the gradient correction
                applyScaleAndGradientTaperUp(imageSamples, scale, fullDifBeforeOverlap, bgDifBeforeOverlap,
                        firstTaperStart_, tgtBox.y0, overlapStart_, tgtBox.y1);
                
                // Overlap region before join. Target side so target overlay
                applyScaleAndGradientToJoin(imageSamples, scale, joinSurfaceSpline,
                        overlapStart_, tgtBox.y0, joinStart_, tgtBox.y1, OVERLAY_TGT);
                
                // Full correction from start of the join region to the end of join 
                applyScaleAndGradientToJoin(imageSamples, scale, joinSurfaceSpline,
                        joinStart_, tgtBox.y0, joinEnd_, tgtBox.y1, joinType_);

                // Overlap region after join. Reference side so reference overlay
                applyScaleAndGradientToJoin(imageSamples, scale, joinSurfaceSpline,
                        joinEnd_, tgtBox.y0, overlapEnd_, tgtBox.y1, OVERLAY_REF);
                        
                // Reference side of join
                // Full correction from end of the join region to the end of the target image 
                applyScaleAndGradient(imageSamples, scale, fullDifAfterOverlap,
                        overlapEnd_, tgtBox.y0, tgtBox.x1, tgtBox.y1, false);
            }
        }
        
    };
    
    /**
     * Create row from reference and target row, applying scale and gradient.
     * This is used for regions either before the taper and join or after taper and join.
     * The applied difArray is constant for all rows in this region.
     * If only creating a corrected target image, the reference row must only contain zeros.
     * @param {ImageSamples} imageSamples 
     * @param {Number} scale Scale to apply
     * @param {Number[]} difArray Gradient to apply
     * @param {Number} x0 Region's min x
     * @param {Number} y0 Region's min y
     * @param {Number} x1 Region's max x
     * @param {Number} y1 Region's max y
     * @param {Boolean} isTargetSide True if x0,x1,y0,y1 bounding box is on target side of join
     */
    function applyScaleAndGradient(imageSamples,
            scale, difArray, x0, y0, x1, y1, isTargetSide){
                
        if (x0 >= x1 || y0 >= y1)
            return;
        
        /**
         * Create row from reference and target row, applying scale and gradient.
         * This is used for regions either before the taper and join or after taper and join.
         * The applied difArray is constant for all rows in this region.
         * If only creating a corrected target image, the reference row must only contain zeros.
         * @param {ImageSamples} imageSamples
         * @param {Number} scale Scale to apply
         * @param {Number[]} difArray Difference between reference and target image
         * along a horizontal or vertical line
         * @param {Number} difArrayStart The difArray index corresponding to row start
         * @param {Boolean} isTargetSide True if x0,x1,y0,y1 bounding box is on target side of join
         */
        function apply(imageSamples, scale, difArray, difArrayStart, isTargetSide){
            let tgtSamples = imageSamples.getTgtSamples();
            let refSamples = imageSamples.getRefSamples();
            let samples = imageSamples.getOutputBuffer();
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
            imageSamples.write();
        }
//        console.write("Processing target[",channel,"]");

        let difArrayStart = isHorizontal_ ? x0 : y0;
        imageSamples.setArea(x0, y0, x1, y1);
        while(imageSamples.hasNext()){
            imageSamples.next();
            apply(imageSamples, scale, difArray, difArrayStart, isTargetSide);
        }
//        console.writeln();
    }
    
    /**
     * Create row from reference and target row, applying scale and gradient
     * and using the mosaic join mode (overlayRef, overlayTgt, random or average)
     * If only creating a corrected target image, the reference row must only 
     * contain zeros (all join modes then effectively become target overlay).
     * @param {ImageSamples} imageSamples 
     * @param {Number} scale Scale to apply
     * @param {surfaceSpline} surfaceSpline Gradient to apply
     * @param {Number} x0 Region's min x
     * @param {Number} y0 Region's min y
     * @param {Number} x1 Region's max x
     * @param {Number} y1 Region's max y
     * @param {Number} joinType OVERLAY_REF, OVERLAY_TGT, OVERLAY_RND or OVERLAY_AVG
     */
    function applyScaleAndGradientToJoin(imageSamples,
            scale, surfaceSpline, x0, y0, x1, y1, joinType){
                
        if (x0 >= x1 || y0 >= y1)
            return;

        function SurfaceSplinePoints(){
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
         * @param {ImageSamples} imageSamples
         * @param {SurfaceSpline} surfaceSpline gradient correction to apply
         * @param {Number} joinType OVERLAY_REF, OVERLAY_TGT, OVERLAY_RND or OVERLAY_AVG
         */
        function apply(imageSamples, surfaceSpline, joinType){
            let tgtSamples = imageSamples.getTgtSamples();
            let refSamples = imageSamples.getRefSamples();
            let samples = imageSamples.getOutputBuffer();
            let surfaceSplinePoints = new SurfaceSplinePoints();
            let x0 = imageSamples.getX();
            let y0 = imageSamples.getY();
            let x = x0;
            let y = y0;
            for (let i = 0; i < samples.length; i++) {
                if (isHorizontal_){
                    x = x0 + i;
                } else {
                    y = y0 + i;
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
                    if (joinType === OVERLAY_AVG && refSamples[idx]){
                        // Average mode. Ref exists so need to calc average
                        samples[idx] = (samples[idx] + refSamples[idx]) / 2;
                    }
                }
            }
            
            imageSamples.write();
        }
        
//        console.write("Processing join  [",channel,"]");
        imageSamples.setArea(x0, y0, x1, y1);
        while(imageSamples.hasNext()){
            imageSamples.next();
            apply(imageSamples, surfaceSpline, joinType);
        }     
//        console.writeln();
    }
    
    /**
     * @param {ImageSamples} imageSamples 
     * @param {Number} scale Scale to apply
     * @param {Number[]} difArray 100% at join edge and then taper down
     * @param {Number[]} bgDif Apply outside join and taper areas
     * @param {Number} x0 Region's min x
     * @param {Number} y0 Region's min y
     * @param {Number} x1 Region's max x
     * @param {Number} y1 Region's max y
     */
    function applyScaleAndGradientTaperDown(imageSamples,
            scale, difArray, bgDif, x0, y0, x1, y1){
        
        if (x0 >= x1 || y0 >= y1)
            return;
        
        /**
         * Create row from reference and target row, applying scale, gradient and taper.
         * If only creating a corrected target image, the reference row must only contain zeros.
         * @param {Number} coord X or Y coordinate of current row
         * @param {Number} taperStart X or Y coordinate of taper start (i.e. at join edge)
         * @param {ImageSamples} imageSamples 
         * @param {Number[]} difArray Difference between reference and target image
         * along a horizontal or vertical line, valid at the join edge
         * @param {Number[]} bgDif Difference between reference and target image
         * along a horizontal or vertical line, valid after taper has finished
         * @param {Number} difArrayStart The difArray index corresponding to row start
         */
        function apply(coord, taperStart, imageSamples, 
                difArray, bgDif, difArrayStart){
            let tgtSamples = imageSamples.getTgtSamples();
            let refSamples = imageSamples.getRefSamples();
            let samples = imageSamples.getOutputBuffer();
            for (let i = 0; i < samples.length; i++) {
                if (tgtSamples[i]){
                    // tgt sample exists. We only taper tgt samples
                    const idx = difArrayStart + i;
                    const bg = bgDif[idx];
                    const delta = difArray[idx] - bg;
                    const fraction = 1 - (coord - taperStart) / taperLength_;
                    const taper = bg + delta * fraction;
                    samples[i] = tgtSamples[i] * scale - taper;
                } else {
                    // No tgt sample. Use ref (which may be zero or non zero)
                    samples[i] = refSamples[i];
                }
            }
            imageSamples.write();
        }
        
//        console.write("Processing taper [",channel,"]");       
        let difArrayStart;
        let taperStart;
        if (isHorizontal_){
            difArrayStart = x0;
            taperStart = y0;
        } else {
            difArrayStart = y0;
            taperStart = x0;
        }
        imageSamples.setArea(x0, y0, x1, y1);
        while(imageSamples.hasNext()){
            imageSamples.next();
            let coord = isHorizontal_ ? imageSamples.getY() : imageSamples.getX();
            apply(coord, taperStart, imageSamples, difArray, bgDif, difArrayStart);
        }        
//        console.writeln();
    }
    
    /**
     * @param {ImageSamples} imageSamples 
     * @param {Number} scale Scale to apply
     * @param {Number[]} difArray Taper up to 100% at join edge
     * @param {Number[]} bgDif Apply outside join and taper areas
     * @param {Number} x0
     * @param {Number} y0
     * @param {Number} x1
     * @param {Number} y1
     */
    function applyScaleAndGradientTaperUp(imageSamples,
            scale, difArray, bgDif, x0, y0, x1, y1){
                
        if (x0 >= x1 || y0 >= y1)
            return;
        
        /**
         * Create row from reference and target row, applying scale, gradient and taper.
         * If only creating a corrected target image, the reference row must only contain zeros.
         * @param {Number} coord X or Y coordinate of current row
         * @param {Number} taperEnd X or Y coordinate of taper end (edge of join)
         * @param {ImageSamples} imageSamples 
         * @param {Number[]} difArray Difference between reference and target image
         * along a horizontal or vertical line, valid at the join edge
         * @param {Number[]} bgDif Difference between reference and target image
         * along a horizontal or vertical line, valid after taper has finished
         * @param {Number} difArrayStart The difArray index corresponding to row start
         */
        function apply(coord, taperEnd, imageSamples, 
                difArray, bgDif, difArrayStart){
            let tgtSamples = imageSamples.getTgtSamples();
            let refSamples = imageSamples.getRefSamples();
            let samples = imageSamples.getOutputBuffer();
            for (let i = 0; i < samples.length; i++) {
                if (tgtSamples[i]){
                    // tgt sample exists. We only taper tgt samples
                    const idx = difArrayStart + i;
                    const bg = bgDif[idx];
                    const delta = difArray[idx] - bg;
                    let fraction = 1 - (taperEnd - coord) / taperLength_;
                    const taper = bg + delta * fraction;
                    samples[i] = tgtSamples[i] * scale - taper;
                } else {
                    // No tgt sample. Use ref (which may be zero or non zero)
                    samples[i] = refSamples[i];
                }
            }
            imageSamples.write();
        }
        
//        console.write("Processing taper [",channel,"]");
        let taperEnd;
        let difArrayStart;
        if (isHorizontal_){
            taperEnd = y1 - 1;
            difArrayStart = x0;
        } else {
            taperEnd = x1 - 1; 
            difArrayStart = y0;
        }
        imageSamples.setArea(x0, y0, x1, y1);
        while(imageSamples.hasNext()){
            imageSamples.next();
            let coord = isHorizontal_ ? imageSamples.getY() : imageSamples.getX();
            apply(coord, taperEnd, imageSamples, difArray, bgDif, difArrayStart);
        }   
//        console.writeln();
    }
    
}

/**
 * Calculates maximum and minimum values for the sample points
 * @param {SamplePair[][]} colorSamplePairs SamplePair[] for each channel
 * @param {Number} minScaleDif Range will be at least +/- this value from the average value
 * @returns {SamplePairDifMinMax}
 */
function SamplePairDifMinMax(colorSamplePairs, minScaleDif) {
    this.minDif = Number.POSITIVE_INFINITY;
    this.maxDif = Number.NEGATIVE_INFINITY;
    this.avgDif = 0;
    let total = 0;
    for (let c=0; c<colorSamplePairs.length; c++) {
        let samplePairs = colorSamplePairs[c];
        total += samplePairs.length;
        for (let samplePair of samplePairs) {
            let dif = samplePair.getDifference();
            this.minDif = Math.min(this.minDif, dif);
            this.maxDif = Math.max(this.maxDif, dif);
            this.avgDif += dif;
        }
    }
    this.avgDif /= total;
    
    if (this.maxDif - this.avgDif < minScaleDif ||
            this.avgDif - this.minDif < minScaleDif){
        this.maxDif = this.avgDif + minScaleDif;
        this.minDif = this.avgDif - minScaleDif;
    }
}

/**
 * Display graph of (difference between images) / (pixel distance across image)
 * @param {Number} width Graph width. Limited to target image size (width or height).
 * @param {Boolean} isHorizontal
 * @param {Boolean} isTargetAfterRef true if target is below reference or target is right of reference 
 * @param {SurfaceSpline[]} surfaceSplines Difference between reference and target images
 * @param {Rect} joinRect Create dif arrays at either side of this rectangle 
 * @param {SamplePair[][]} colorSamplePairs The SamplePair points to be displayed for each channel
 * @param {PhotometricMosaicData} data User settings used to create FITS header
 * @param {Boolean} isPropagateGraph If true, display single line for target side of overlap bounding box
 * @returns {undefined}
 */
function GradientGraph(width, isHorizontal, isTargetAfterRef, surfaceSplines, 
        joinRect, colorSamplePairs, data, isPropagateGraph){
    
    {   // Constructor
        let graph = createGraph(width, isHorizontal, isTargetAfterRef, surfaceSplines, 
                joinRect, colorSamplePairs, data, isPropagateGraph);

        // Display graph in script dialog
        GraphDialog.prototype = new Dialog;
        let graphDialog = new GraphDialog(graph.getGraphBitmap(), "Gradient Graph", graph.screenToWorld);
        if (graphDialog.execute() === StdButton_Yes){
            // User requested graph saved to PixInsight View
            let windowTitle = WINDOW_ID_PREFIX() + data.targetView.fullId + "__Gradient";
            let imageWindow = graph.createWindow(windowTitle, true);
            gradientGraphFitsHeader(imageWindow, data, isHorizontal, isTargetAfterRef);
            imageWindow.show();
        }
    }
    
    /**
     * 
     * @param {Number} width
     * @param {Boolean} isHorizontal
     * @param {Boolean} isTargetAfterRef
     * @param {SurfaceSpline[]} surfaceSplines
     * @param {Rect} joinRect
     * @param {SamplePair[][]} colorSamplePairs
     * @param {type} data
     * @param {PhotometricMosaicData} isPropagateGraph
     * @returns {Graph}
     */
    function createGraph(width, isHorizontal, isTargetAfterRef, surfaceSplines, 
                joinRect, colorSamplePairs, data, isPropagateGraph){
        let xMaxCoordinate;
        let xLabel;
        if (isHorizontal){
            xLabel = "Mosaic tile join X-coordinate";
            xMaxCoordinate = data.targetView.image.width;
        } else {
            xLabel = "Mosaic tile join Y-coordinate";
            xMaxCoordinate = data.targetView.image.height;
        }
        let yLabel = "(" + data.targetView.fullId + ") - (" + data.referenceView.fullId + ")";
        let axisWidth = Math.min(width, xMaxCoordinate);
        // Graph scale
        // gradientArray stores min / max of fitted lines.
        // also need min / max of sample points.
        const minScaleDif = 5e-5;
        let yCoordinateRange = new SamplePairDifMinMax(colorSamplePairs, minScaleDif);

        return createAndDrawGraph(xLabel, yLabel, xMaxCoordinate, yCoordinateRange, axisWidth,
                isHorizontal, isTargetAfterRef, surfaceSplines, 
                joinRect, colorSamplePairs, data, isPropagateGraph, 1);
    }
    
    /**
     * 
     * @param {ImageWindow} graphWindow Graph window
     * @param {PhotometricMosaicData} data User settings used to create FITS header
     * @param {Boolean} isHorizontal
     * @param {Boolean} isTargetAfterRef
     */
    function gradientGraphFitsHeader(graphWindow, data, isHorizontal, isTargetAfterRef){
        let view = graphWindow.mainView;
        view.beginProcess(UndoFlag_NoSwapFile); // don't add to undo list
        let keywords = graphWindow.keywords;
        fitsHeaderImages(keywords, data);
        fitsHeaderStarDetection(keywords, data);
        fitsHeaderPhotometry(keywords, data);
        let includeGradient = (data.viewFlag === DISPLAY_GRADIENT_GRAPH());
        let includePropagate = (data.viewFlag === DISPLAY_PROPAGATE_GRAPH());
        fitsHeaderGradient(keywords, data, includeGradient, includePropagate);
        fitsHeaderOrientation(keywords, isHorizontal, isTargetAfterRef);
        fitsHeaderMosaic(keywords, data);
        graphWindow.keywords = keywords;
        view.endProcess();
    }
    
    /**
     * Draw gradient line and sample points for a single color channel.
     * @param {Graph} graph
     * @param {Boolean} isHorizontal
     * @param {Number[][]} difArrays Array of DifArray to draw
     * @param {Number} lineBoldColor
     * @param {GraphLinePath} graphLinePath Specifies which line should be bold
     * @param {Number} lineColor
     * @param {SamplePair[]} samplePairs
     * @param {Number} pointColor
     * @returns {undefined}
     */
    function drawLineAndPoints(graph, isHorizontal,
            difArrays, lineBoldColor, graphLinePath, lineColor, samplePairs, pointColor) {
                
        for (let samplePair of samplePairs) {
            // Draw the sample points
            let coord = isHorizontal ? samplePair.rect.center.x : samplePair.rect.center.y;
            graph.drawPoint(coord, samplePair.getDifference(), pointColor);
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
    }
    
    /**
     * 
     * @param {String} xLabel
     * @param {String} yLabel
     * @param {Number} xMaxCoordinate
     * @param {SamplePairDifMinMax} yCoordinateRange
     * @param {Number} axisWidth
     * @param {Boolean} isHorizontal
     * @param {Boolean} isTargetAfterRef
     * @param {SurfaceSpline[]} surfaceSplines
     * @param {Rect} joinRect
     * @param {SamplePair[][]} colorSamplePairs
     * @param {PhotometricMosaicData} data
     * @param {Boolean} isPropagateGraph
     * @param {Number} zoomFactor
     * @returns {Graph}
     */
    function createAndDrawGraph(xLabel, yLabel, xMaxCoordinate, yCoordinateRange, axisWidth,
            isHorizontal, isTargetAfterRef, surfaceSplines, joinRect, colorSamplePairs,
            data, isPropagateGraph, zoomFactor){
        let maxY = yCoordinateRange.maxDif;
        let minY = yCoordinateRange.minDif;
        
        let graph = new Graph(0, minY, xMaxCoordinate, maxY);
        graph.setAxisLength(axisWidth + 2, 720);
        graph.createGraph(xLabel, yLabel);

        let graphLine = new GraphLinePath();
        if (isPropagateGraph){
            graphLine.initPropagatePath(data.cache.overlap, isHorizontal, isTargetAfterRef);
        } else {
            graphLine.initGradientPaths(data.cache.overlap, joinRect, isHorizontal, isTargetAfterRef, data);
        }

        if (colorSamplePairs.length === 1){ // B&W
            let difArrays = [];
            for (let path of graphLine.paths){
                difArrays.push(surfaceSplines[0].evaluate(path).toArray());
            }
            drawLineAndPoints(graph, isHorizontal,
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
                let graphAreaOnly = graph.createGraphAreaOnly();
                drawLineAndPoints(graphAreaOnly, isHorizontal,
                    difArrays, lineBoldColors[c], graphLine, lineColors[c], colorSamplePairs[c], pointColors[c]);
                graph.mergeWithGraphAreaOnly(graphAreaOnly);
            }
        }
        return graph;
    }
}


function GraphLinePath(){
    /** {Point[][]} paths min, mid and max paths across overlap region */
    this.paths = [];
    /** {Boolean[]} bold Draw nth line bold */
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
