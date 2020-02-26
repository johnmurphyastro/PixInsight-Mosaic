// Version 1.0 (c) John Murphy 20th-Feb-2020
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
 * @param {Number} x
 * @param {Number} y
 * @param {Number} width Rectangle width
 * @param {Number} height Rectangle height
 * @returns {Rectangle}
 */
function Rectangle(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
}

/**
 * 
 * @param {Number} targetMedian
 * @param {Number} referenceMedian
 * @param {Number} x X-Coordinate at the center of the sample
 * @param {Number} y Y-Coordinate at the center of the sample
 * @returns {SamplePair}
 */
function SamplePair(targetMedian, referenceMedian, x, y) {
    this.targetMedian = targetMedian;
    this.referenceMedian = referenceMedian;
    this.x = x;
    this.y = y;
}

/**
 * @param {type} samplePair
 * @returns {Number} x
 */
function getHorizontalGradientX(samplePair) {
    return samplePair.x;
}
/**
 * @param {type} samplePair
 * @returns {Number} targetMedian - referenceMedian
 */
function getHorizontalGradientY(samplePair) {
    return samplePair.targetMedian - samplePair.referenceMedian;
}

/**
 * @param {type} samplePair
 * @returns {Number} y
 */
function getVerticalGradientX(samplePair) {
    return samplePair.y;
}
/**
 * @param {type} samplePair
 * @returns {Number} targetMedian - referenceMedian
 */
function getVerticalGradientY(samplePair) {
    return samplePair.targetMedian - samplePair.referenceMedian;
}

/**
 * Contains SamplePair[]
 * @param {SamplePair[]} samplePairArray
 * @param {Number} sampleSize
 * @param {Rectangle} selectedArea Area selected by user (e.g. via preview)
 * @returns {SamplePairs}
 */
function SamplePairs(samplePairArray, sampleSize, selectedArea){
    /** SamplePair[] */
    this.samplePairArray = samplePairArray;
    /** Number */
    this.sampleSize = sampleSize;
    /** Rectangle */
    this.selectedArea = selectedArea;
    /** Rectangle, Private */
    this.sampleArea = null;                             // Private

    /**
     * @returns {Rectangle} Bounding rectangle of all samplePair
     */
    this.getSampleArea = function(){
        if (this.sampleArea === null) {
            let minX = Number.MAX_VALUE;
            let minY = Number.MAX_VALUE;
            let maxX = 0;
            let maxY = 0;
            for (let samplePair of samplePairArray) {
                minX = Math.min(minX, samplePair.x);
                maxX = Math.max(maxX, samplePair.x);
                minY = Math.min(minY, samplePair.y);
                maxY = Math.max(maxY, samplePair.y);
            }
            this.sampleArea = new Rectangle(minX, minY, maxX - minX, maxY - minY);
        }
        return this.sampleArea;
    };
}

// ============ Algorithms ============
/**
 * Create SamplePairs for each color channel
 * @param {Image} targetImage
 * @param {Image} referenceImage
 * @param {Image} starRegionMask Bitmap image with overlapping region set to 1
 * @param {Number} sampleSize
 * @param {Number} logStarDetectionSensitivity
 * @param {Number} rejectHigh Ignore samples that contain pixels > rejectHigh
 * @param {Number} rejectNearBrightStars Remove the N brightest SamplePairs before returning the array
 * @param {Rectangle} selectedArea Reject samples outside this area
 * @returns {SamplePairs[]} Returns SamplePairs for each color
 */
function createColorSamplePairs(targetImage, referenceImage, starRegionMask,
        sampleSize, logStarDetectionSensitivity, rejectHigh, rejectNearBrightStars, selectedArea) {
    
    let starDetector = new StarDetector();
    starDetector.mask = starRegionMask;
    starDetector.sensitivity = Math.pow(10.0, logStarDetectionSensitivity);
    starDetector.upperLimit = 1;
    //starDetector.noiseReductionFilterRadius = 1;
    let stars = starDetector.stars(referenceImage);

    // Sort the Star array so that the brightest stars are at the top
    stars.sort((a, b) => b.flux - a.flux);
            
    // Create colorSamplePairs with empty SamplePairsArrays
    let nChannels = referenceImage.isColor ? 3 : 1;
    let colorSamplePairs = new Array(nChannels);
    for (let c=0; c<nChannels; c++){
        colorSamplePairs[c] = new SamplePairs([], sampleSize, selectedArea, true);
    }
    
    // Create the sample
    let binRect = new Rectangle(0, 0, sampleSize, sampleSize);
    let x1 = selectedArea.x;
    let y1 = selectedArea.y;
    let x2 = selectedArea.x + selectedArea.width - sampleSize;
    let y2 = selectedArea.y + selectedArea.height - sampleSize;
    
    for (let y = y1; y < y2; y+= sampleSize) {
        for (let x = x1; x < x2; x+= sampleSize) {
            binRect.x = x;
            binRect.y = y;
            addSamplePair(colorSamplePairs, targetImage, referenceImage, nChannels,
                    stars, rejectHigh, rejectNearBrightStars, binRect);
        }
    }
    return colorSamplePairs;
}

/**
 * Create a SamplePair and add it to the supplied colorSamplePairs array
 * @param {SamplePairs[]} colorSamplePairs
 * @param {Image} targetImage
 * @param {Image} referenceImage
 * @param {Number} nChannels
 * @param {Star[]} stars
 * @param {Number} clipping
 * @param {Number} rejectNearBrightStars
 * @param {Rectangle} binRect
 */
function addSamplePair(colorSamplePairs, targetImage, referenceImage, nChannels,
        stars, clipping, rejectNearBrightStars, binRect){
    
    /**
     * @param sample Pixel value to check
     * @param clipping Maximum allowed pixel value
     * @return true if the sample is out of range and should therefore be excluded
     */
    let isBlackOrClipped = (sample, clipping) => sample === 0 || sample > clipping;
    
    let samplePairX = binRect.x + (binRect.width-1) / 2;
    let samplePairY = binRect.y + (binRect.height-1) / 2;
    let squareRoot2 = Math.pow(2, 0.5);
    
    for (let c=0; c<nChannels; c++){
        let refValues = [];
        let tgtValues = [];
        
        // Process all pixels within this sample
        for (let y = 0; y < binRect.height; y++) {
            for (let x = 0; x < binRect.width; x++) {
                let tgtSample = targetImage.sample(binRect.x + x, binRect.y + y, c);
                if (isBlackOrClipped(tgtSample, clipping)) {
                    return;
                }

                let refSample = referenceImage.sample(binRect.x + x, binRect.y + y, c);
                if (isBlackOrClipped(refSample, clipping)) {
                    return;
                }

                tgtValues.push(tgtSample);
                refValues.push(refSample);
            }
        }
        
        // is sample too close to a star?
        let nStars = Math.floor(stars.length * rejectNearBrightStars / 100);
        if (nStars > 1) {
            let starArea = stars[0].size;
            let starRadius = Math.sqrt(starArea)/2;
            let minDist = starRadius + squareRoot2 * binRect.width/2;
            let squaredMinDist = minDist * minDist;
            for (let i = 0; i < nStars; i++) {
                let star = stars[i];
                let deltaX = star.pos.x - samplePairX;
                let deltaY = star.pos.y - samplePairY;
                if (deltaX * deltaX + deltaY * deltaY < squaredMinDist) {
                    return;
                }
            }
        }
        
        let tgtMedian = Math.median(tgtValues);
        let refMedian = Math.median(refValues);
        let samplePair = new SamplePair(tgtMedian, refMedian, samplePairX, samplePairY);
        let samplePairs = colorSamplePairs[c];
        samplePairs.samplePairArray.push(samplePair);
    }
}

/** Display the SamplePair by drawing them into a mask image
 * @param {Image} view Determine bitmap size from this view's image.
 * @param {SamplePairs} samplePairs The samplePairs to be displayed.
 * @param {String} title Window title
 */
function displaySampleSquares(view, samplePairs, title) {
    let sampleSize = samplePairs.sampleSize;
    let square = new Rect(sampleSize, sampleSize);
    let offset = (sampleSize - 1) / 2;
    
    let image = view.image;
    let bmp = new Bitmap(image.width, image.height);
    bmp.fill(0xffffffff);
    //let G = new VectorGraphics(bmp);
    let G = new Graphics(bmp);
    G.pen = new Pen(0xff000000);
    samplePairs.samplePairArray.forEach(function (samplePair) {
        let x = samplePair.x - offset;
        let y = samplePair.y - offset;
        square.moveTo(x, y);
        G.drawRect(square);
    });
    G.end();

    let w = new ImageWindow(bmp.width, bmp.height,
            1, // numberOfChannels
            8, // bitsPerSample
            false, // floatSample
            false, // color
            title);
    w.mainView.beginProcess(UndoFlag_NoSwapFile);
    w.mainView.image.blend(bmp);
    w.mainView.endProcess();
    w.show();
    //w.zoomToFit();
}
        
/**
 * Create samplePairArray. Divide the target and reference images into Rectangles.
 * The rectanles have dimension sampleSize x sampleSize.
 * For each rectangle, calculate the average sample value for the specified channel.
 * If either the target or reference rectange contains a black sample or a samples
 * greater than rejectHigh, the SamplePair is not added to the array.
 * Using a super binned sample makes fitting the data to a line more robust because
 * it ensures that stars have the same size (less than a single pixel) in both
 * the target and reference images. SampleSize should be between 1 and 5 times
 * greater than the diameter of bright stars. 3 times works well.
 *
 * @param {Image} targetImage
 * @param {Image} referenceImage
 * @param {Number} channel This number Indicates L=0 or R=0, G=1, B=2
 * @param {Number} rejectHigh Ignore samples that contain pixels > rejectHigh
 * @return {SamplePairs} Array of target and reference binned sample values
 */
function createCfaSamplePairs(targetImage, referenceImage, channel, rejectHigh) {
    // Divide the images into blocks specified by sampleSize.
    let w = referenceImage.width;
    let h = referenceImage.height;
    let firstY = channel < 2 ? 0 : 1;
    let firstX;
    if (channel === 1 || channel === 3){
        firstX = 0;
    } else {
        firstX = 1;
    }

    /**
     * @param sample Pixel value to check
     * @param rejectHigh Maximum allowed pixel value
     * @return true if the sample is out of range and should therefore be excluded
     */
    let isBlackOrClipped = (sample, rejectHigh) => sample === 0 || sample > rejectHigh;

    let samplePairArray = [];
    for (let y = firstY; y < h; y+=2) {
        for (let x = firstX; x < w; x+=2) {
            let targetSample = targetImage.sample(x, y, 0);
            if (isBlackOrClipped(targetSample, rejectHigh)) {
                continue;
            }
            let referenceSample = referenceImage.sample(x, y, 0);
            if (isBlackOrClipped(referenceSample, rejectHigh)) {
                continue;
            }
            let pairedAverage = new SamplePair(targetSample, referenceSample, x, y);
            samplePairArray.push(pairedAverage);
        }
    }

    let selectedArea = new Rectangle(0, 0, w, h);
    return new SamplePairs(samplePairArray, 1, selectedArea, false);
}
