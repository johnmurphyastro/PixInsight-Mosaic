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
    image.getSamples(buffer, rect);
    for (let i=0; i<buffer.length; i+=100){
        if (buffer[i])
            return false;
    }
    for (let c=0; c<nChannels; c++){
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
    this.free = function(){
        this.hasOverlap = false;
        this.refBox = null;
        this.tgtBox = null;
        this.overlapBox = null;
        if (this.overlapMask !== null){
            this.overlapMask.free();
            this.overlapMask = null;
        }
    };
    
    // Please treat as read only outside this class
    /** {Rect} overlapMask bounding box */
    this.overlapBox = null;
    /** {Image} bitmap indicates were ref & tgt images overlap */
    this.overlapMask = null;
    /** True if refBox and TgtBox intersect */
    this.hasOverlap = false;
    /** {Rect} refBox Reference image bounding box */
    this.refBox = getBoundingBox(refImage);
    /** {Rect} tgtBox Target image bounding box */
    this.tgtBox = getBoundingBox(tgtImage);
    
    if (!this.refBox.intersects(this.tgtBox)){
        this.free();
        return;
    }
    this.hasOverlap = true;

    // intersectBox will be equal to or larger than the overlap region.
    // For example, if the images are fatter outside the overlap
    const intersectBox = this.refBox.intersection(this.tgtBox);
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

    this.overlapMask = new Image(refImage.width, refImage.height, 1);
//        mask.fill(0);     // I assume this is not necessary
    this.overlapMask.setSamples(maskBuffer, intersectBox);

    x0 += intersectBox.x0;
    x1 += intersectBox.x0;
    y0 += intersectBox.y0;
    y1 += intersectBox.y0;
    if (x0 !== Number.POSITIVE_INFINITY){
        this.overlapBox = new Rect(x0, y0, x1+1, y1+1);
    } else {
        this.overlapBox = null;
    }
}
