/* global ImageWindow, ChannelExtraction, UndoFlag_NoSwapFile, MultiscaleLinearTransform, StdButton_Yes, GraphDialog, APERTURE_GROWTH, APERTURE_ADD, APERTURE_GROWTH_LIMIT, APERTURE_BKG_DELTA */

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
//"use strict";
#define __PJSR_NO_STAR_DETECTOR_TEST_ROUTINES 1
#define __PJSR_STAR_OBJECT_DEFINED  1

#define APERTURE_ADD 1
#define APERTURE_GROWTH 1.0
#define APERTURE_GROWTH_LIMIT 10
#define APERTURE_BKG_DELTA 10
#include "StarDetector.jsh"

function Star(pos, flux, size) {
    // Centroid position in pixels, image coordinates (from StarDetector).
    this.pos = new Point(pos.x, pos.y);
    // Total flux, normalized intensity units (from StarDetector).
    this.flux = flux;
    // Area of detected star structure in square pixels (from StarDetector).
    this.size = size;

    // Value at peak (from StarDetector)
    let _peakValue;
    // Star bounding box (from StarDetector)
    let _boundingBox;
    
    // Calculated aperture rectangle
    let _starAperture;
    // Calculated radius
    let _starRadius;
    // Calculated star only flux (total flux - background flux)
    let _starFlux;
    // true if no zero pixels
    this.fluxOk = true;
    this.bkgOk = true;

    /** This method should be called only once, after the constructor but before calcStarFlux().
     * @param {Number} bkg Local background estimate.
     * @param {Number} peak Value at peak
     * @param {Rect} rect Star bounding box
     */
    this.setBkgPeakRect = function (bkg, peak, rect) {
        this.setBoundingBox(rect);
        _peakValue = peak;
        _starFlux = this.flux - bkg * this.size;
    };
    
    this.setBoundingBox = function (rect){
        _boundingBox = new Rect(rect);
    };
    
    this.setPeakValue = function (peakValue){
        _peakValue = peakValue;
    };
    
    /**
     * Star was detected within a cropped image. Move it to the full image coordinate.
     * @param {Number} x0
     * @param {Number} y0
     */
    this.moveBy = function(x0, y0){
        this.pos.x += x0;
        this.pos.y += y0;
        _boundingBox.moveBy(x0, y0);
    };
    
    /**
     * Create and store an array of all the image samples that are inbetween
     * an inner and outer rectangle.
     * @param {Image} image
     * @param {Rect} innerRect
     * @param {Number} bkgDelta
     * @param {Number} channel
     * @returns {StarPair.BackgroundSamples}
     */
    function BackgroundSamples(image, innerRect, bkgDelta, channel){
        let outerRect = innerRect.inflatedBy( bkgDelta );
        let top =    new Rect(outerRect.x0, outerRect.y0, outerRect.x1, innerRect.y0);
        let bottom = new Rect(outerRect.x0, innerRect.y1, outerRect.x1, outerRect.y1);
        let left =   new Rect(outerRect.x0, innerRect.y0, innerRect.x0, innerRect.y1);
        let right =  new Rect(innerRect.x1, innerRect.y0, outerRect.x1, innerRect.y1);
        
        /**
         * Read a rectangle of samples from the image,
         * and append the values to the allSamples array.
         * @param {Number[]} allSamples
         * @param {Image} image
         * @param {Rect} rect
         * @param {Number} channel
         */
        function appendSamples(allSamples, image, rect, channel){
            let samples = new Float64Array(rect.area);
            image.getSamples(samples, rect, channel);
            for (let i=0; i<samples.length; i++){
                if (samples[i] > 0){ // don't include black pixels
                    allSamples.push(samples[i]);
                }
            }
        }
        
        /** All image samples inbetween the inner and outer rectangles  */
        this.allSamples = [];
        appendSamples(this.allSamples, image, top, channel);
        appendSamples(this.allSamples, image, bottom, channel);
        appendSamples(this.allSamples, image, left, channel);
        appendSamples(this.allSamples, image, right, channel);
        
        /** The number of black pixels (excluded from the allSamples array) */
        this.zeroCount = (top.area + bottom.area + left.area + right.area) - this.allSamples.length;
    }

    /** Private method
     * Sets the star aperture and then calculates th star's flux and radius.
     * @param {Image} image 
     * @param {Number} channel Color channel
     * @param {Rect} aperture The star aperture
     * @param {Number} bgDelta Thickness of background annulus
     */
    this.calcStarFlux = function (image, channel, aperture, bgDelta) {
        // Calculate total star flux (i.e. star + star background)
        let length = aperture.area;
        let samples = new Float64Array(length);
        let nSamples = 0;
        let flux = 0;
        image.getSamples(samples, aperture, channel);
        for (let i = 0; i < length; i++) {
            if (samples[i] > 0) {
                flux += samples[i];
                nSamples++;
            }
        }
        let bgSamples = new BackgroundSamples(image, aperture, bgDelta, channel);
        let bg = Math.median(bgSamples.allSamples);
        this.fluxOk = (nSamples === length);      // false if star rect contained black samples
        this.bkgOk = (bgSamples.zeroCount === 0); // false if bg contained black samples
        _starFlux = flux - bg * nSamples;
        _starAperture = aperture;
        _starRadius = Math.max(aperture.width, aperture.height) / 2;
    };
    
    /**
     * This method is used straight after StarDetection to improve the star flux accuracy
     * @param {Image} image 
     * @param {Number} channel Color channel
     * @param {Number} apertureAdd Add this number of pixels to the bounding box
     * @param {Number} apertureGrowthRate Aperture increase depends on star flux
     * @param {Number} apertureGrowthLimit Aperture growth is limited to this number of pixels
     * @param {Number} apertureBgDelta Thickness of background annulus
     */
    this.recalcStarFlux = function(image, channel, apertureAdd, apertureGrowthRate, apertureGrowthLimit, apertureBgDelta){
        let inflate = calcApertureCorrection(
                apertureAdd, apertureGrowthRate, apertureGrowthLimit, _starFlux);
        let aperture = _boundingBox.inflatedBy(Math.round(inflate));
        this.calcStarFlux(image, channel, aperture, apertureBgDelta);
    };
    
    /**
     * Creates a new star with the same position, peak value and bounding box.
     * The star's flux is calculated from the supplied image and aperture.
     * @param {Image} image 
     * @param {Number} channel Color channel
     * @param {Rect} aperture The star aperture
     * @param {Number} bgDelta Thickness of background annulus
     */
    this.factory = function(image, channel, aperture, bgDelta){
        let s = new Star(this.pos, this.flux, this.size);
        s.setPeakValue(_peakValue);
        s.setBoundingBox(_boundingBox);
        s.calcStarFlux(image, channel, aperture, bgDelta);
        return s;
    };

    /**
     * @returns {rect} star bounding box (from StarDetector)
     */
    this.getBoundingBox = function () {
        return _boundingBox;
    };
    
    /**
     * @returns {Number} star peak value (from StarDetector)
     */
    this.getPeakValue = function () {
        return _peakValue;
    };
    
    /**
     * @returns {Number} Calculated star flux
     */
    this.getStarFlux = function (){
        return _starFlux;
    };
    
    /**
     * @returns {Number} Photometry star aperture
     */
    this.getStarAperture = function (){
        return _starAperture;
    };
    
    /**
     * @returns {Number} Star radius
     */
    this.getStarRadius = function (){
        return _starRadius;
    };
}

/**
 * @param {Number} apertureAdd
 * @param {Number} growthRate
 * @param {Number} growthLimit
 * @param {Number} starFlux
 * @returns {Number} Inflate the star's bounding box by this to create aperture.
 * Does not round the result.
 */
function calcApertureCorrection(apertureAdd, growthRate, growthLimit, starFlux){
    return apertureAdd + Math.min(growthRate * starFlux, growthLimit);
}

/**
 * @param {PhotometricMosaicData} data Values from user interface
 * @param {Image} refImage
 * @param {Image} tgtImage
 * @param {Star} refStar
 * @param {Star} tgtStar
 * @param {Number} channel
 * @returns {StarPair}
 */
function StarPair(data, refImage, tgtImage, refStar, tgtStar, channel){
    
    /**
     * Used to increase the size of the star bounding box
     * @param {Star} refStar
     * @param {Star} tgtStar
     * @returns {StarPair.Delta}
     */
    function Delta (refStar, tgtStar){
        let refRect = refStar.getBoundingBox();
        let tgtRect = tgtStar.getBoundingBox();
        this.top = Math.max(refStar.pos.y - refRect.y0, tgtStar.pos.y - tgtRect.y0);
        this.left = Math.max(refStar.pos.x - refRect.x0, tgtStar.pos.x - tgtRect.x0);
        this.bottom = Math.max(refRect.y1 - refStar.pos.y, tgtRect.y1 - tgtStar.pos.y);
        this.right = Math.max(refRect.x1 - refStar.pos.x, tgtRect.x1 - tgtStar.pos.x);
        
        let maxFlux = Math.max(refStar.getStarFlux(), tgtStar.getStarFlux());
        let inflate = Math.round(calcApertureCorrection(
                data.apertureAdd, data.apertureGrowthRate, data.apertureGrowthLimit, maxFlux));
        this.top += inflate;
        this.left += inflate;
        this.bottom += inflate;
        this.right += inflate;
    }
    
    let delta = new Delta(refStar, tgtStar);
    
    this.refStar = createStar(refImage, refStar, delta, data.apertureBgDelta, channel);
    this.tgtStar = createStar(tgtImage, tgtStar, delta, data.apertureBgDelta, channel);
    
    /**
     * Create a star based on the supplied star, but with a larger star rectangle
     * and a new background rectangle.
     * The star's total flux and background level are calculated.
     * @param {Image} image The image the star is from
     * @param {Star} star Original star (not modified)
     * @param {StarPair.Delta} delta Specifies how to inflate the star rectangle
     * @param {Number} bkgDelta Distance between inner and outer rectangles
     * @param {Number} channel Color channel
     * @returns {Star}
     */
    function createStar(image, star, delta, bkgDelta, channel){
        let x0 = Math.round(star.pos.x - delta.left);
        let y0 = Math.round(star.pos.y - delta.top);
        let x1 = Math.round(star.pos.x + delta.right);
        let y1 = Math.round(star.pos.y + delta.bottom);
        let aperture = new Rect(x0, y0, x1, y1);
        return star.factory(image, channel, aperture, bkgDelta);
    }
}

/**
 * @param {View} refView
 * @param {View} tgtView 
 * @returns {StarsDetected}
 */
function StarsDetected(refView, tgtView){
    this.refView = refView;
    this.tgtView = tgtView;
    /** {star[][]} color array of reference stars */
    this.refColorStars = null;
    /** {star[][]} color array of target stars */
    this.tgtColorStars = null;
    /** {Star[]} refColorStars and tgtColorStars, sorted by star flux */
    this.allStars = null;
    /** If true, write information to console */
    this.showConsoleInfo = true;

    const self = this;
    
    /**
     * @param {Number} logSensitivity
     * @param {MosaicCache} cache
     */
    this.detectStars = function (logSensitivity, cache) {
        let nChannels = refView.image.isColor ? 3 : 1;
        const overlapBox = cache.overlap.overlapBox;
        // Reference and target image stars
        if (cache.refColorStars === null || cache.tgtColorStars === null){
            let detectStarTime = new Date().getTime();
            writeln("<b><u>Detecting stars</u></b>");
            processEvents();
            cache.allStars = null;
            cache.refColorStars = [];
            cache.tgtColorStars = [];
            let overlapMask = cache.overlap.getOverlapMask();
            for (let c = 0; c < nChannels; c++) {
                let refStars = findStars(this.refView, overlapMask, overlapBox, 
                        logSensitivity, c);
                cache.refColorStars.push(refStars);
                writeln("Reference[" + c + "] detected " + refStars.length + " stars");
                processEvents();
                
                let tgtStars = findStars(this.tgtView, overlapMask, overlapBox, 
                        logSensitivity, c);
                cache.tgtColorStars.push(tgtStars);
                writeln("Target   [" + c + "] detected " + tgtStars.length + " stars");
                processEvents();
            }
            overlapMask.free();
            writeln(getElapsedTime(detectStarTime) + "\n");
            processEvents();
        }
        this.refColorStars = cache.refColorStars;
        this.tgtColorStars = cache.tgtColorStars;
        
        // Reference and target stars, sorted by star flux
        if (cache.allStars === null){
            cache.allStars = combienStarArrays(cache.refColorStars, cache.tgtColorStars);
        }
        this.allStars = cache.allStars;
    };
    
    /**
     * 
     * @param {Number} nChannels
     * @param {PhotometricMosaicData} data Values from user interface
     * @returns {StarPair[][]} Array of StarPair[] for each color channels
     */
    this.getColorStarPairs = function(nChannels, data){
        let colorStarPairs = [];
        for (let channel=0; channel < nChannels; channel++){
            let starPairs = findMatchingStars(channel, data);
            // Remove outliers
            for (let i=0; i<data.outlierRemoval; i++){
                if (starPairs.length < 4){
                    console.warningln("Channel[" + channel + "]: Only " + starPairs.length +
                        " photometry stars. Keeping outlier.");
                    break;
                }
                let linearFitData = calculateScale(starPairs);
                starPairs = removeStarPairOutlier(starPairs, linearFitData);
            }
            colorStarPairs.push(starPairs);
        }
        return colorStarPairs;
    }; 
    
    /**
     * Private
     * @param {View} view
     * @param {Image} mask Bitmap represents overlapping region
     * @param {Rect} overlapBox Bounding box of the overlap area
     * @param {Number} logSensitivity
     * @param {Number} channel
     * @returns {Star[]}
     */
    function findStars(view, mask, overlapBox, logSensitivity, channel){
        let lastProgressPc = 0;
        function progressCallback(count, total){
            if (count === 0){
                console.write("<end><cbr>Detecting stars:   0%");
                lastProgressPc = 0;
                processEvents();
            } else{
                let pc = Math.round(100 * count / total);
                if (pc > lastProgressPc && (pc > lastProgressPc + 5 || pc === 100)){
                    if (pc < 100){
                        console.write(format("\b\b\b\b%3d%%", pc));
                    } else {
                        console.write(format("\b\b\b\b"));
                    }
                    lastProgressPc = pc;
                    processEvents();
                }
            }
            return true;
        }

        let starImage;
        // Create grey scale 32bit floating point images
        let width = overlapBox.width;
        let height = overlapBox.height;
        starImage = new Image(width, height, 1);
        let samples = new Float32Array(overlapBox.area);
        view.image.getSamples(samples, overlapBox, channel);
        starImage.setSamples(samples);
        
        // In tests this was 8% slower, probably because we had to assign the whole area
//        starImage.assign(view.image, new Rect(width, height), channel, channel); // 8% slower
        // Detect stars in target and reference images
        let starDetector = new StarDetector();
        starDetector.progressCallback = progressCallback;
        starDetector.mask = mask;
        starDetector.sensitivity = Math.pow(10.0, logSensitivity);
        starDetector.upperLimit = 1;
        // Noise reduction affects the accuracy of the photometry
        starDetector.applyHotPixelFilterToDetectionImage = false;
        starDetector.bkgDelta = APERTURE_BKG_DELTA;
        
        const x0 = overlapBox.x0;
        const y0 = overlapBox.y0;
        let stars = starDetector.stars(starImage);
        starImage.free();
        for (let star of stars){
            star.moveBy(x0, y0);
            // Calculate the flux, this time using an inflated star aperture
            star.recalcStarFlux(view.image, channel, 
                    APERTURE_ADD, APERTURE_GROWTH, APERTURE_GROWTH_LIMIT, APERTURE_BKG_DELTA);
        }
        return stars;
    }
    
    /**
     * Finds the stars that exist in both images that have no pixel above upperLimit.
     * @param {Number} channel
     * @param {PhotometricMosaicData} data Values from user interface
     * @returns {StarPair[]} Matching star pairs. All star pixels are below the upperLimit.
     */
    function findMatchingStars(channel, data) {
        let searchRadius = data.starSearchRadius;
        let rSqr = searchRadius * searchRadius;

        /**
         * Sort on flux, brightest stars at the end of the array
         * @param {Star} a
         * @param {Star} b
         * @returns {Number}
         */
        function sortOnFlux(a, b) {
            return a.getStarFlux() - b.getStarFlux();
        };

        /**
         * Filter out stars with a peak pixel value greater than peakUpperLimit,
         * sort the stars on flux (brightest star at end of array).
         * Limit the total number of stars to a percentage of the input stars,
         * or a percentage of 1000 if there are more than 1000 stars in the input
         * array. The dimmest stars are filtered out.
         * @param {Star[]} stars Stars to be filtered. This array is not modified.
         * @param {PhotometricMosaicData} data Values from user interface
         * @returns {Star[]} The filtered stars
         */
        function filterStars(stars, data){
            let peakUpperLimit = data.linearRange;
            let limitStarsPercent = data.limitPhotoStarsPercent;
            let filteredStars = [];
            for (let star of stars) {
                if (star.getPeakValue() < peakUpperLimit) {
                    filteredStars.push(star);
                }
            }
            filteredStars.sort(sortOnFlux);
            let maxStars = Math.min(filteredStars.length, 1000) * limitStarsPercent / 100;
            if (filteredStars.length > maxStars) {
                filteredStars = filteredStars.slice(filteredStars.length - maxStars);
            }
            return filteredStars;
        };
        
        /**
         * Use flux and search radius to match stars.
         * Start with the brightest ref star and look for the brightest tgt star
         * within the searchRadius. If a tgt star is found it is removed from tgtStar array.
         * @param {PhotometricMosaicData} data Values from user interface
         * @param {Star[]} tgtStars Modified (entries are removed)
         * @param {Star[]} refStars
         * @param {Boolean} useRange If true, reject pairs if the flux difference is too great
         * @param {Number} minGradient Minimum allowed (ref flux / target flux) 
         * @param {Number} maxGradient Maximum allowed (ref flux / target flux) 
         * @param {Number} channel
         * @returns {StarPair[]} Array of matched stars
         */
        function matchStars(data, tgtStars, refStars, useRange, minGradient, maxGradient, channel){
            let refImage = self.refView.image;
            let tgtImage = self.tgtView.image;
            let searchRadius = data.starSearchRadius;
            let starPairArray = [];
            let r = refStars.length;
            while (r--) {
                let rStar = refStars[r];
                if (!rStar.fluxOk )
                    continue;
                
                let t = tgtStars.length;
                while (t--) {
                    let tStar = tgtStars[t];
                    if (!tStar.fluxOk )
                        continue;
                
                    if (useRange){
                        let gradient = rStar.getStarFlux() / tStar.getStarFlux();
                        if (gradient < minGradient || gradient > maxGradient){
                            continue;
                        }
                    }
                    let deltaX = Math.abs(tStar.pos.x - rStar.pos.x);
                    if (deltaX < searchRadius){
                        let deltaY = Math.abs(tStar.pos.y - rStar.pos.y);
                        if (deltaY < searchRadius && rSqr > deltaX * deltaX + deltaY * deltaY) {
                            let starPair = new StarPair(data, refImage, tgtImage, rStar, tStar, channel);
                            if (starPair.refStar.fluxOk && starPair.tgtStar.fluxOk /* && 
                                starPair.refStar.bkgOk && starPair.tgtStar.bkgOk */)
                            {
                                starPairArray.push(starPair);
                            }
                            // Remove star so it is not matched multiple times
                            // This should be efficient because the brightest stars are at the end of the array
                            tgtStars.splice(t, 1);
                            break;
                        }
                    }
                }
            }
            return starPairArray;
        };
        
        let refStars = filterStars(self.refColorStars[channel], data);
        let tgtStars = filterStars(self.tgtColorStars[channel], data);
        
        // Use our first pass to calculate the approximate gradient. This pass might contain
        // stars that matched with noise or very faint stars
        let tgtStarsClone = tgtStars.slice();
        let starPairArray = matchStars(data, tgtStarsClone, refStars, false, 0, 0, channel);
        if (starPairArray.length > 10) {
            // Second pass rejects stars if (refFlux / tgtFlux) is higher or lower than expected
            let linearFit = calculateScale(starPairArray);
            const gradient = linearFit.m;
            const tolerance = data.starFluxTolerance;
            let starPairArray2 = matchStars(data, tgtStars, refStars,
                    true, gradient / tolerance, gradient * tolerance, channel);
            if (starPairArray2.length > 5){
                let nRemoved = starPairArray.length - starPairArray2.length;
                if (nRemoved){
                    writeln("Channel[" + channel + "] Removed " + nRemoved +
                            " photometry stars with large flux differences");
                }
                return starPairArray2;
            }
        }
        return starPairArray;
    }

    /**
     * Combien star arrays removing duplicate stars (keep star with maximum flux)
     * @param {star[][]} refColorStars color array of reference stars
     * @param {star[][]} tgtColorStars color array of target stars
     * @returns {Star[]} All stars, sorted by brightness (brightest first)
     */
    function combienStarArrays(refColorStars, tgtColorStars){
        /**
         * @param {Star} star
         * @returns {String}
         */
        function starToKey(star){
            return "" + star.pos.x + "," + star.pos.y;
        };
        /**
         * @param {Map} starMap
         * @param {Star[]} stars
         */
        function addFirstArray(starMap, stars) {
            for (let star of stars) {
                starMap.set(starToKey(star), star);
            }
        };
        /**
         * @param {Map} starMap
         * @param {Star[]} stars
         */
        function addStars(starMap, stars){
            for (let star of stars){
                // keep star with maximum flux
                let key = starToKey(star);
                let mapStar = starMap.get(key);
                if (mapStar === undefined || mapStar.getStarFlux() < star.getStarFlux()){
                    starMap.set(key, star);
                }
            }
        };
        /**
         * @param {Map} starMap
         * @returns {Star[]} All stars, sorted by brightness (brightest first)
         */
        function getSortedStars(starMap){
            let stars = [];
            for (let star of starMap.values()){
                stars.push(star);
            }
            return stars.sort((a, b) => b.getStarFlux() - a.getStarFlux());
        };

        // Add all the stars to a map to reject duplicates at the same coordinates
        let starMap = new Map();
        addFirstArray(starMap, refColorStars[0]);
        for (let c = 1; c < refColorStars.length; c++) {
            addStars(starMap, refColorStars[c]);
        }
        for (let c = 0; c < tgtColorStars.length; c++) {
            addStars(starMap, tgtColorStars[c]);
        }
        return getSortedStars(starMap);
    }
    
    function writeln(consoleMsg){
        if (self.showConsoleInfo){
            console.writeln(consoleMsg);
        }
    }
}

/**
 * @param {StarPair[]} starPairs
 * @returns {LinearFitData} Least Square Fit between reference & target star flux
 */
function calculateScale(starPairs) {
    let leastSquareFit = new LeastSquareFitAlgorithm();
    for (let starPair of starPairs) {
        leastSquareFit.addValue(starPair.tgtStar.getStarFlux(), starPair.refStar.getStarFlux());
    }
    return leastSquareFit.getOriginFit();
}

/**
 * Removes the worst outlier from the photometry least squares fit line
 * @param {StarPair[]} starPairs A star pair will be removed
 * @param {LinearFitData} linearFit
 * @returns {StarPair[]}
 */
function removeStarPairOutlier(starPairs, linearFit){
    let maxErr = Number.NEGATIVE_INFINITY;
    let removeStarPairIdx = -1;
    for (let i=0; i<starPairs.length; i++){
        let starPair = starPairs[i];
        // Calculate the perpendicular distance of this point from the best fit line
        let x = starPair.tgtStar.getStarFlux();
        let y = starPair.refStar.getStarFlux();
        let perpDist = Math.abs(
                (y - linearFit.m * x + linearFit.b) / Math.sqrt(linearFit.m * linearFit.m + 1));
        if (perpDist > maxErr){
            maxErr = perpDist;
            removeStarPairIdx = i;
        }
    }
    if (removeStarPairIdx !== -1){
        starPairs.splice(removeStarPairIdx, 1);
    }
    return starPairs;
}

/**
 * Calculates the max and min star flux
 * @returns {StarMinMax}
 */
function StarMinMax() {
    this.maxRefFlux = Number.NEGATIVE_INFINITY;
    this.maxTgtFlux = Number.NEGATIVE_INFINITY;
    this.minRefFlux = Number.POSITIVE_INFINITY; 
    this.minTgtFlux = Number.POSITIVE_INFINITY;

    /**
     * Find max and min for the (corrected) star flux 
     * @param {StarPair[]} starPairArray
     * @returns {undefined}
     */
    this.calculateMinMax = function(starPairArray){
        for (let starPair of starPairArray) {
            this.maxRefFlux = Math.max(this.maxRefFlux, starPair.refStar.getStarFlux());
            this.maxTgtFlux = Math.max(this.maxTgtFlux, starPair.tgtStar.getStarFlux());
            this.minRefFlux = Math.min(this.minRefFlux, starPair.refStar.getStarFlux());
            this.minTgtFlux = Math.min(this.minTgtFlux, starPair.tgtStar.getStarFlux());
        }
    };
}

/**
 * Display photometry graph of reference flux against target flux
 * @param {String} refView
 * @param {String} tgtView
 * @param {StarsDetected} detectedStars
 * @param {PhotometricMosaicData} data Values from user interface
 * @param {PhotometricMosaicDialog} photometricMosaicDialog
 */
function displayStarGraph(refView, tgtView, detectedStars, data, photometricMosaicDialog){
    let nChannels = refView.image.isColor ? 3 : 1;
    let preserveAspectRatio = true;
    {   // Constructor
        // The ideal width and height ratio depends on the graph line's gradient
        let height = photometricMosaicDialog.logicalPixelsToPhysical(data.graphHeight);
        let width = photometricMosaicDialog.logicalPixelsToPhysical(data.graphWidth);
        let tmpGraph = createZoomedGraph(1, width, height);
        if (tmpGraph.preferredWidth < width){
            width = tmpGraph.preferredWidth;
            height = tmpGraph.preferredHeight;
        } 
        preserveAspectRatio = false;
        
        // Display graph in script dialog
        let graphDialog = new PhotometryGraphDialog("Photometry Graph", width, height, 
            data, photometricMosaicDialog, createZoomedGraph);
        graphDialog.execute();
    }
    
    /**
     * Callback function for GraphDialog to provide a zoomed graph.
     * GraphDialog uses Graph.getGraphBitmap() and the function pointer Graph.screenToWorld
     * @param {Number} factor
     * @param {Number} width
     * @param {Number} height
     * @param {Number} selectedChannel R=0, G=1, B=2, All=3
     * @returns {Graph}
     */
    function createZoomedGraph(factor, width, height, selectedChannel){
        let colorStarPairs = detectedStars.getColorStarPairs(nChannels, data);
        let scaleFactors = getScaleFactors(colorStarPairs);
        let graph = createGraph(refView.fullId, tgtView.fullId, width, height, 
            colorStarPairs, scaleFactors, factor, preserveAspectRatio, selectedChannel);
        return graph;
    }
    
    /**
     * @param {StarPair[][]} colorStarPairs StarPair[] for L or R,G,B
     * @returns {LinearFitData[]}
     */
    function getScaleFactors(colorStarPairs){
        let scaleFactors = [];
        for (let starPairs of colorStarPairs){
            let linearFitData = calculateScale(starPairs);
            scaleFactors.push(linearFitData);
        }
        return scaleFactors;
    }
    
    /**
     * Draw graph lines and points for a single color
     * @param {Graph} graph
     * @param {Number} lineColor e.g. 0xAARRGGBB
     * @param {StarPair[]} starPairs
     * @param {LinearFitData} linearFit
     * @param {Number} pointColor e.g. 0xAARRGGBB
     * @returns {undefined}
     */
    function drawStarLineAndPoints(graph, lineColor, starPairs, linearFit, pointColor){
        graph.drawLine(linearFit.m, linearFit.b, lineColor);
        for (let starPair of starPairs){
            graph.drawPoint(starPair.tgtStar.getStarFlux(), starPair.refStar.getStarFlux(), pointColor);
        }
    };
    
    /**
     * 
     * @param {String} targetName
     * @param {String} referenceName
     * @param {Number} width 
     * @param {Number} height
     * @param {StarPair[][]} colorStarPairs StarPair[] for each color
     * @param {LinearFitData[]} scaleFactors Lines are drawn through origin with these gradients
     * @param {Number} zoomFactor
     * @param {Boolean} preserveAspectRatio 
     * @param {Number} selectedChannel R=0, G=1, B=2, All=3
     * @returns {Graph}
     */
    function createGraph(referenceName, targetName, width, height, colorStarPairs, 
            scaleFactors, zoomFactor, preserveAspectRatio, selectedChannel){
        let targetLabel = "Target (" + targetName + ")";
        let referenceLabel = "Reference (" + referenceName + ")";

        // Create the graph axis and annotation.
        let minMax = new StarMinMax();
        colorStarPairs.forEach(function (starPairs) {
            minMax.calculateMinMax(starPairs);
        });
        if (minMax.minRefFlux === Number.POSITIVE_INFINITY || minMax.minTgtFlux === Number.NEGATIVE_INFINITY){
            // Default scale from 0 to 1
            minMax.minRefFlux = 0;
            minMax.minTgtFlux = 0;
            minMax.maxRefFlux = 1;
            minMax.maxTgtFlux = 1;
        }
        if (zoomFactor !== 1){
            minMax.maxRefFlux = minMax.minRefFlux + (minMax.maxRefFlux - minMax.minRefFlux) / zoomFactor;
            minMax.maxTgtFlux = minMax.minTgtFlux + (minMax.maxTgtFlux - minMax.minTgtFlux) / zoomFactor;
        }
        let startOffsetX = (minMax.maxTgtFlux - minMax.minTgtFlux) / 100;
        let startOffsetY = (minMax.maxRefFlux - minMax.minRefFlux) / 100;
        // If there is only one point, min & max will be equal. Prevent zero length axis.
        if (startOffsetX === 0){
            startOffsetX = minMax.minTgtFlux !== 0 ? minMax.minTgtFlux : 0.0001;
        }
        if (startOffsetY === 0){
            startOffsetY = minMax.minRefFlux !== 0 ? minMax.minRefFlux : 0.0001;
        }
        let graphWithAxis = new Graph(minMax.minTgtFlux - startOffsetX, minMax.minRefFlux - startOffsetY,
                                      minMax.maxTgtFlux, minMax.maxRefFlux);
        graphWithAxis.createGraph(targetLabel, referenceLabel, width, height, preserveAspectRatio);

        // Now add the data to the graph...
        if (colorStarPairs.length === 1){ // B&W
            drawStarLineAndPoints(graphWithAxis, 0xFF777777, colorStarPairs[0], scaleFactors[0], 0xFFFFFFFF);
        } else {
            // Color. Need to create 3 graphs for r, g, b and then merge them (binary OR) so that
            // if three samples are on the same pixel we get white and not the last color drawn
            let lineColors = [0xFF770000, 0xFF007700, 0xFF000077]; // r, g, b
            let pointColors = [0xFFFF0000, 0xFF00FF00, 0xFF0000FF]; // r, g, b
            for (let c = 0; c < colorStarPairs.length; c++){
                if (selectedChannel === 3 || selectedChannel === c){
                    let graphAreaOnly = graphWithAxis.createGraphAreaOnly();
                    drawStarLineAndPoints(graphAreaOnly, lineColors[c], colorStarPairs[c], scaleFactors[c], pointColors[c]);
                    graphWithAxis.mergeWithGraphAreaOnly(graphAreaOnly);
                }
            }
        }
        
        return graphWithAxis;
    }
}

/**
 * @param {View} tgtView Used to access the target view fullId
 * @param {Overlap} overlap Specifies the overlapping pixels
 * @param {Rect} joinRect Restricts the mask to join instead of using all overlap pixels
 */
function createJoinMask(tgtView, overlap, joinRect){
    const width = tgtView.image.width;
    const height = tgtView.image.height;
    const overlapMask = overlap.getFullImageMask(width, height);
    const maskValue = 0.8;
    // Restrict the mask to the joinRect rather than using the whole overlap
    let maskSamples = new Float32Array(joinRect.area);
    overlapMask.getSamples(maskSamples, joinRect);
    overlapMask.free();
    for (let i = 0; i < maskSamples.length; i++){
        // When overlapMask is 1, mask will be transparent, which is what we want.
        if (maskSamples[i] === 0){
            // When overlapMask is 0, it will be solid red. We want some transparency.
            maskSamples[i] = maskValue;
        }
    }
    let title = WINDOW_ID_PREFIX() + tgtView.fullId + "__JoinMask";
    let w = new ImageWindow(width, height, 1, 8, false, false, title);
    let view = w.mainView;
    view.beginProcess(UndoFlag_NoSwapFile);
    view.image.fill(maskValue);
    view.image.setSamples(maskSamples, joinRect);
    view.endProcess();
    w.show();
}

/**
 * @param {Star} star
 * @param {PhotometricMosaicData} data
 * @returns {Number} Star radius
 */
function calcStarMaskRadius(star, data){
    let starBox = star.getBoundingBox();
    let r = Math.max(starBox.width, starBox.height) / 2;
    let delta = calcApertureCorrection(data.maskStarRadiusAdd, 
            data.maskStarGrowthRate, data.maskStarGrowthLimit, star.getStarFlux());
    return r + delta;
}

/**
 * @param {Star} star
 * @param {PhotometricMosaicData} data
 * @param {Number} growthLimit data.sampleStarGrowthLimit or data.sampleStarGrowthLimitTarget
 * @returns {Number} Star radius
 */
function calcSampleStarRejectionRadius(star, data, growthLimit){
    let starBox = star.getBoundingBox();
    let r = Math.max(starBox.width, starBox.height) / 2;
    let delta = calcApertureCorrection(data.sampleStarRadiusAdd, 
            data.sampleStarGrowthRate, growthLimit, star.getStarFlux());
    return r + delta;
}

/**
 * @param {View} tgtView
 * @param {Rect} joinArea 
 * @param {StarsDetected} detectedStars
 * @param {PhotometricMosaicData} data User settings used to create FITS header
 */
function createStarMask(tgtView, joinArea, detectedStars, data){
    let postfix = "Mask";
    let title = WINDOW_ID_PREFIX() + tgtView.fullId + "__" + data.limitMaskStarsPercent + "_" + postfix;
    let imageWidth = tgtView.image.width;
    let imageHeight = tgtView.image.height;
    let bmp = new Bitmap(imageWidth, imageHeight);
    bmp.fill(0xffffffff);
    
    let firstNstars;
    if (data.limitMaskStarsPercent < 100){
        firstNstars = Math.floor(detectedStars.allStars.length * data.limitMaskStarsPercent / 100);
    } else {
        firstNstars = detectedStars.allStars.length;
    }
    
    let clipRect = new Rect(joinArea);
    clipRect.deflateBy(3); // to allow for the 3 pixel soft edge growth
    let graphics;
    try {
        graphics = new VectorGraphics(bmp);
        graphics.antialiasing = true;
        graphics.brush = new Brush();
        graphics.clipRect = clipRect;

        for (let i = 0; i < firstNstars; ++i){
            let star = detectedStars.allStars[i];
            let radius = calcStarMaskRadius(star, data);
            graphics.fillCircle(star.pos, radius);
        }
    } catch (e) {
        console.criticalln("StarLib createStarMask error: " + e);
    } finally {
        graphics.end();
    }
    bmp.invert();

    // Create new window and copy bitmap to its image.
    // width, height, nChannels, bitsPerSample, floatSample, color, title
    let w = new ImageWindow(imageWidth, imageHeight, 1, 8, false, false, title);
    let view = w.mainView;
    view.beginProcess(UndoFlag_NoSwapFile);
    view.image.blend(bmp);

    // Make the star edges soft
    let P = new MultiscaleLinearTransform;
    P.layers = [// enabled, biasEnabled, bias, noiseReductionEnabled, noiseReductionThreshold, noiseReductionAmount, noiseReductionIterations
        [false, true, 0.000, false, 3.000, 1.00, 1],
        [false, true, 0.000, false, 3.000, 1.00, 1],
        [true, true, 0.000, false, 3.000, 1.00, 1]
    ];
    P.transform = MultiscaleLinearTransform.prototype.StarletTransform;
    P.executeOn(w.mainView, false);
    
    // Make sure the star mask circles do not include pixels beyond the overlap.
    let overlapMask = data.cache.overlap.getFullImageMask(imageWidth, imageHeight);
    let minX = Math.max(0, joinArea.x0 - 10);
    let minY = Math.max(0, joinArea.y0 - 10);
    let maxX = Math.min(bmp.width, joinArea.x1 + 10);
    let maxY = Math.min(bmp.height, joinArea.y1 + 10);
    for (let x = minX; x < maxX; x++){
        for (let y = minY; y < maxY; y++){
            if (overlapMask.sample(x, y) === 0 && view.image.sample(x, y) !== 0){
                view.image.setSample(0, x, y);
            }
        }
    }
    overlapMask.free();

    let keywords = [];
    fitsHeaderImages(keywords, data);
    fitsHeaderStarDetection(keywords, data);
    fitsHeaderMask(keywords, data);
    
    w.keywords = keywords;
    view.endProcess();
    w.show();
}
