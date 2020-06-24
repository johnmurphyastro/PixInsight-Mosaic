// Version 1.0 (c) John Murphy 22nd-April-2020
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

/**
 * @param {Image} image
 * @returns {Rect} Bounding box of non zero pixels
 */
function getBoundingBox(image){
    const width = image.width;
    const height = image.height;
    const nChannels = image.isColor ? 3 : 1;
    let startP = image.maximumPosition();
    let x0 = 0;
    let x1 = image.width;
    let y0 = 0;
    let y1 = image.height;

    let row = new Rect(width, 1);
    let col = new Rect(1, height);
    let rowBuffer = new Float32Array(row.area);
    let colBuffer = new Float32Array(col.area);
    
    // Find the approximate edges
    row.moveTo(0, startP.y);
    image.getSamples(rowBuffer, row);
    for (let x = startP.x; x >= 0; x--){
        if (!rowBuffer[x]){
            x0 = Math.min(x + 1, width);
            break;
        }
    }
    for (let x = startP.x; x < width; x++){
        if (!rowBuffer[x]){
            x1 = x;
            break;
        }
    }
    col.moveTo(startP.x, 0);
    image.getSamples(colBuffer, col);
    for (let y = startP.y; y >= 0; y--){
        if (!colBuffer[y]){
            y0 = Math.min(y + 1, height);
            break;
        }
    }
    for (let y = startP.y; y < height; y++){
        if (!colBuffer[y]){
            y1 = y;
            break;
        }
    }
    
    // Refine to accurate bounding box
    for (; y0 > 0; y0--){
        row.moveTo(0, y0 - 1);
        if (isBlack(image, rowBuffer, row, nChannels)){
            break;
        }
    }
    for (; y1 < height; y1++){
        row.moveTo(0, y1);
        if (isBlack(image, rowBuffer, row, nChannels)){
            break;
        }
    }
    
    for (; x0 > 0; x0--){
        col.moveTo(x0 - 1, 0);
        if (isBlack(image, colBuffer, col, nChannels)){
            break;
        }
    }
    for (; x1 < width; x1++){
        col.moveTo(x1, 0);
        if (isBlack(image, colBuffer, col, nChannels)){
            break;
        }
    }
    return new Rect(x0, y0, x1, y1); 
}

/**
 * @param {Image} image Target image
 * @param {TypedArray} buffer Samples in rect will be read into this buffer. 
 * @param {Rect} rect Rectangle that represents a single pixel row or column
 * @param {Number} nChannels 1 for B&W, 3 for color
 * @returns {Boolean} Return true if all pixels in rect are black
 */
function isBlack(image, buffer, rect, nChannels){
    image.getSamples(buffer, rect, 0);
    // fast check
    for (let i=0; i<buffer.length; i+=100){
        if (buffer[i])
            return false;
    }
    // Now check every sample
    for (let i=0; i<buffer.length; i++){
        if (buffer[i])
            return false;
    }
    for (let c=1; c<nChannels; c++){
        image.getSamples(buffer, rect, c);
        for (let i=0; i<buffer.length; i++){
            if (buffer[i])
                return false;
        }
    }
    return true;
}

/**
 * @param {Image} image Target image
 * @param {Rect} overlap Area of Interest Preview rectangle
 * @param {Number} nChannels 1 for B&W, 3 for color
 * @returns {Boolean} True if the target image is below the reference image
 */
function isImageBelowOverlap(image, overlap, nChannels){
    const height = image.height;
    let line = new Rect(overlap.x0, 0, overlap.x1, 1);
    let lineBuffer = new Float32Array(line.area);
    for (let offset = 0; ;offset++){
        let y = overlap.y0 - offset;
        line.moveTo(overlap.x0, y);
        if (y === 0 || isBlack(image, lineBuffer, line, nChannels)){
            return true;
        }
        y = overlap.y1 + offset;
        line.moveTo(overlap.x0, y);
        if (y === height || isBlack(image, lineBuffer, line, nChannels)){
            return false;
        }
    }
}

/**
 * 
 * @param {Image} image Target image
 * @param {Rect} overlap Area of Interest Preview rectangle
 * @param {Number} nChannels 1 for B&W, 3 for color
 * @returns {Boolean} True if the target image is to right of the reference image
 */
function isImageRightOfOverlap(image, overlap, nChannels){
    const width = image.width;
    let line = new Rect(0, overlap.y0, 1, overlap.y1);
    let lineBuffer = new Float32Array(line.area);
    for (let offset = 0; ;offset++){
        let x = overlap.x0 - offset;
        line.moveTo(x, overlap.y0);
        if (x === 0 || isBlack(image, lineBuffer, line, nChannels)){
            return true;
        }
        x = overlap.x1 + offset;
        line.moveTo(x, overlap.y0);
        if (x === width || isBlack(image, lineBuffer, line, nChannels)){
            return false;
        }
    }
}

/**
 * Extend the subRect rectangle in the specified direction to the superRect size
 * @param {Rect} subRect Small rectangle (not modified)
 * @param {Rect} superRect Large rectangle (not modified)
 * @param {Rect} isHorizontal extend small rectangle in this direction
 * @returns {Rect} The extended subRect
 */
function extendSubRect(subRect, superRect, isHorizontal){
    if (isHorizontal){
        return new Rect(superRect.x0, subRect.y0, superRect.x1, subRect.y1);
    }
    return new Rect(subRect.x0, superRect.y0, subRect.x1, superRect.y1);
}

/**
 * 
 * @param {Image} refImage
 * @param {Image} tgtImage
 */
function Overlap(refImage, tgtImage){
    // Please treat as read only outside this class
    /** {Rect} overlapMask bounding box */
    this.overlapBox = null;
    /** {Rect} refBox Reference image bounding box */
    this.refBox = getBoundingBox(refImage);
    /** {Rect} tgtBox Target image bounding box */
    this.tgtBox = getBoundingBox(tgtImage);
    
    /** {TypedArray} bitmap array from overlapBox. A value of 1 indicates were ref & tgt images overlap */
    let overlapMaskBuffer_;
    /** True if refBox and TgtBox intersect */
    let hasOverlapFlag_ = false;
    /** Arrays storing min & max coordinates of non zero pixels */
    let minOutlineAtX_ = null;
    let maxOutlineAtX_ = null;
    let minOutlineAtY_ = null;
    let maxOutlineAtY_ = null;
    
    let self = this;
    
    /**
     * Construct object
     * @param {Rect} refBox
     * @param {Rect} tgtBox
     */
    function construct(refBox, tgtBox){
        if (!refBox.intersects(tgtBox)){
            hasOverlapFlag_ = false;
            return;
        }
        hasOverlapFlag_ = true;
        let result = calculateOverlapBox(refImage, tgtImage, refBox, tgtBox);
        self.overlapBox = result.overlapBox;
        overlapMaskBuffer_ = result.overlapMaskBuffer;
    }
    
    /**
     * @returns {Boolean} True if the reference and target images overlap
     */
    this.hasOverlap = function(){
        return hasOverlapFlag_;
    };
    
    /**
     * @returns {Float32Array}
     */
    this.getOverlapMaskBuffer = function(){
        return overlapMaskBuffer_;
    };
    
    /**
     * Create a mask image that is the same size as the reference image
     * Only the pixels within the overlapBox will be non zero.
     * Call Image.free() when the image is no longer needed.
     * @param {Number} imageWidth
     * @param {Number} imageHeight  
     * @returns {Image}
     */
    this.getFullImageMask = function(imageWidth, imageHeight){
        let imageMask = new Image(imageWidth, imageHeight, 1);
//        mask.fill(0);     // I assume this is not necessary
        imageMask.setSamples(this.getOverlapMaskBuffer(), this.overlapBox);
        return imageMask;
    };
    
    /**
     * Create a mask image for the overlapBox.
     * The image is the same size as the overlapBox.
     * Call Image.free() when the image is no longer needed.
     * @returns {Image}
     */
    this.getOverlapMask = function(){
        let overlapMask = new Image(this.overlapBox.width, this.overlapBox.height, 1);
        overlapMask.setSamples(this.getOverlapMaskBuffer());
        return overlapMask;
    };
    
    /**
     * Creates a path that follows the horizontal line if it is within the 
     * overlaping pixels. If it is above the overlap, it follows the top outline
     * of the overlap. If below, the bottom outline.
     * @param {Number} yCoord Specifies horizontal line y = yCoord
     * @returns {Point[]} The horizontal path constrained by the overlap
     */
    this.calcHorizOutlinePath = function(yCoord){
        if (minOutlineAtX_ === null || maxOutlineAtX_ === null){
            calculateOutlineAtX(this.overlapBox);
        }
        let path = new Array(minOutlineAtX_.length);
        for (let i=0; i<path.length; i++){
            if (yCoord < minOutlineAtX_[i].y){
                // horizontal line is above top outline so use top outline
                path[i] = new Point(minOutlineAtX_[i]);
            } else if (yCoord > maxOutlineAtX_[i].y){
                // horizontal line is below bottom outline so use bottom outline
                path[i] = new Point(maxOutlineAtX_[i]);
            } else {
                // Horizontal line is inside overlap so use horizontal line
                path[i] = new Point(minOutlineAtX_[i].x, yCoord);
            }
        }
        return path;
    };
    
    /**
     * Creates a path that follows the vertical line if it is within the 
     * overlaping pixels. If it is left of the overlap, it follows the left outline
     * of the overlap. If right, the right outline.
     * @param {Number} xCoord Specifies vertical line x = xCoord
     * @returns {Point[]} The vertical path constrained by the overlap
     */
    this.calcVerticalOutlinePath = function(xCoord){
        if (minOutlineAtY_ === null || maxOutlineAtY_ === null){
            calculateOutlineAtY(this.overlapBox);
        }
        let path = new Array(minOutlineAtY_.length);
        for (let i=0; i<path.length; i++){
            if (xCoord < minOutlineAtY_[i].x){
                // vertical line is left of left outline so use left outline
                path[i] = new Point(minOutlineAtY_[i]);
            } else if (xCoord > maxOutlineAtY_[i].x){
                // vertical line is right of right outline so use right outline
                path[i] = new Point(maxOutlineAtY_[i]);
            } else {
                // vertical line is inside overlap so use vertical line
                path[i] = new Point(xCoord, minOutlineAtY_[i].y);
            }
        }
        return path;
    };
    
    /**
     * @param {Point[]} minAtXArray
     * @param {Point[]} maxAtXArray
     * @returns {Point[]}
     */
    this.getMidOutlineAtXArray = function(minAtXArray, maxAtXArray){
        let length = minAtXArray.length;
        let midAtX = new Array(length);
        for (let i=0; i<length; i++){
            let avgY = (minAtXArray[i].y + maxAtXArray[i].y) / 2;
            midAtX[i] = new Point(minAtXArray[i].x, avgY);
        }
        return midAtX;
    };
    
    /**
     * @param {Point[]} minAtYArray
     * @param {Point[]} maxAtYArray
     * @returns {Point[]}
     */
    this.getMidOutlineAtYArray = function(minAtYArray, maxAtYArray){
        let length = minAtYArray.length;
        let midAtY = new Array(length);
        for (let i=0; i<length; i++){
            let avgX = (minAtYArray[i].x + maxAtYArray[i].x) / 2;
            midAtY[i] = new Point(avgX, minAtYArray[i].y);
        }
        return midAtY;
    };
    
    /**
     * @param {Image} refImage
     * @param {Image} tgtImage
     * @param {Rect} refBox Bounding box of non zero area
     * @param {Rect} tgtBox Bounding box of non zero area
     * @returns {overlapBox: overlapBox, overlapMaskBuffer: overlapMaskBuffer}
     */
    function calculateOverlapBox(refImage, tgtImage, refBox, tgtBox){
        // intersectBox will be equal to or larger than the overlap region.
        // For example, if the images are fatter outside the overlap
        const intersectBox = refBox.intersection(tgtBox);
        const xMin = intersectBox.x0;
        const xMax = intersectBox.x1;
        const yMin = intersectBox.y0;
        const yMax = intersectBox.y1;  
        const width = intersectBox.width;

        // Overlap bounding box coordinates
        let x0 = Number.POSITIVE_INFINITY;
        let x1 = Number.NEGATIVE_INFINITY;
        let y0 = Number.POSITIVE_INFINITY;
        let y1 = Number.NEGATIVE_INFINITY;

        // Create a mask to restrict the star detection to the overlapping area and previewArea
        const bufLen = intersectBox.area;
        let refBuffer = [];
        let tgtBuffer = [];
        const nChannels = refImage.isColor ? 3 : 1;
        for (let c=0; c<nChannels; c++){
            refBuffer[c] = new Float32Array(bufLen);
            tgtBuffer[c] = new Float32Array(bufLen);
            refImage.getSamples(refBuffer[c], intersectBox, c);
            tgtImage.getSamples(tgtBuffer[c], intersectBox, c);
        }
        let maskBuffer = new Float32Array(bufLen);

        for (let i=0; i<bufLen; i++){
            let isOverlap = true;
            for (let c = nChannels - 1; c > -1; c--) {
                if (tgtBuffer[c][i] === 0 || refBuffer[c][i] === 0) {
                    isOverlap = false;
                    break;
                }
            }
            if (isOverlap) {
                maskBuffer[i] = 1;
                // Determine bounding box
                let y = Math.floor(i/width);
                let x = i % width;
                x0 = Math.min(x0, x);
                x1 = Math.max(x1, x);
                y0 = Math.min(y0, y);
                y1 = Math.max(y1, y);
            }
        }
        // x1 and y1 both need to be just after the last pixel (x1 - x0 = width)
        x1++;
        y1++;

        // We have the mask buffer in terms of the intersection box.
        // We need it in terms of the overlapBox
        let overlapMaskBuffer = new Float32Array((x1 - x0) * (y1 - y0));
        let i = 0;
        for (let y = y0; y < y1; y++){
            let yXwidth = y * width;
            for (let x = x0; x < x1; x++){
                overlapMaskBuffer[i++] = maskBuffer[yXwidth + x];
            }
        }

        x0 += intersectBox.x0;
        x1 += intersectBox.x0;
        y0 += intersectBox.y0;
        y1 += intersectBox.y0;
        let overlapBox = new Rect(x0, y0, x1, y1);
        return {overlapBox: overlapBox, overlapMaskBuffer: overlapMaskBuffer};
    }
    
    /**
     * Calculates and stores the overlap pixel horizontal outline.
     * minOutlineAtX_ stores points for the top side of the outline.
     * maxOutlineAtX_ stores points for the bottom side of the outline.
     * The stored (x,y) coordinates are image coordinates.
     * The index of the array is the nth x pixel for the local overlap region
     * (i.e. index 0 corresponds to the left most point of the overlap bounding box).
     * For each local value of x, the image x, and minimum, maximum values of y are stored.
     * @param {Rect} overlapBox (input)
     */
    function calculateOutlineAtX(overlapBox){
        // Get local overlap coordinates of outline
        let w = overlapBox.width;
        let h = overlapBox.height;
        let x0 = overlapBox.x0;
        let y0 = overlapBox.y0;
        minOutlineAtX_ = new Array(w);
        maxOutlineAtX_ = new Array(w);
        for (let x=0; x<w; x++){
            for (let y=0; y<h; y++){
                let i = y * w + x;
                if (overlapMaskBuffer_[i]){
                    minOutlineAtX_[x] = new Point(x + x0, y + y0);
                    break;
                }
            }
            for (let y = h - 1; y >= 0; y--){
                let i = y * w + x;
                if (overlapMaskBuffer_[i]){
                    maxOutlineAtX_[x] = new Point(x + x0, y + y0);
                    break;
                }
            }
        }
    }
    
    /**
     * Calculates and stores the overlap pixel vertical outline.
     * minOutlineAtY_ stores points for the left side of the outline.
     * maxOutlineAtY_ stores points for the right side of the outline.
     * The stored (x,y) coordinates are image coordinates.
     * The index of the array is the nth x pixel for the local overlap region
     * (i.e. index 0 corresponds to the upper most point of the overlap bounding box).
     * For each local value of y, the image minimum, maximum values of x, and the image y are stored.
     * @param {Rect} overlapBox (input)
     */
    function calculateOutlineAtY(overlapBox){
        let w = overlapBox.width;
        let h = overlapBox.height;
        let x0 = overlapBox.x0;
        let y0 = overlapBox.y0;
        minOutlineAtY_ = new Array(h);
        maxOutlineAtY_ = new Array(h);
        for (let y=0; y<h; y++){
            let yXw = y * w;
            for (let x=0; x<w; x++){
                let i = yXw + x;
                if (overlapMaskBuffer_[i]){
                    minOutlineAtY_[y] = new Point(x + x0, y + y0);
                    break;
                }
            }
            for (let x = w - 1; x >= 0; x--){
                let i = yXw + x;
                if (overlapMaskBuffer_[i]){
                    maxOutlineAtY_[y] = new Point(x + x0, y + y0);
                    break;
                }
            }
        }
    }
    
    construct(this.refBox, this.tgtBox);
}
