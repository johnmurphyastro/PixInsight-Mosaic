// Version 1.0 (c) John Murphy 31st-Mar-2020
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

function MosaicCache() {
    /**
    * User input data used to calculate stored values
    * @param {String} refId
    * @param {String} tgtId
    * @param {Number} logSensitivity
    */
    function UserInputData (refId, tgtId, logSensitivity){
        this.refId = refId;
        this.tgtId = tgtId;
        this.logSensitivity = logSensitivity;

        /**
         * Set user input data and check if it has changed
         * @param {String} refId
         * @param {String} tgtId
         * @param {Number} logSensitivity
         * @return {Boolean} true if one or more of the values don't match stored values
         */
        this.setData = function (refId, tgtId, logSensitivity){
            if (refId !== this.refId || tgtId !== this.tgtId ||
                    logSensitivity !== this.logSensitivity){
                this.refId = refId;
                this.tgtId = tgtId;
                this.logSensitivity = logSensitivity;
                return true;
            }
            return false;
        };
    };
    
    this.userInputData = new UserInputData(null, null, Number.NaN);
    
    /** Stores refBox, tgtBox, overlapBox, overlapMask, hasOverlap */
    this.overlap = null;
    /** {star[][]} color array of reference stars */
    this.refColorStars = null;
    /** {star[][]} color array of target stars */
    this.tgtColorStars = null;
    /** {Star[]} refColorStars and tgtColorStars, sorted by star flux */
    this.allStars = null;
    /** Map of surface spline models */
    this.surfaceSplineMap = new Map();
    /** Map of SampleGridMap */
    this.sampleGridMapMap = new Map();
    /** Map of samplePairs */
    this.samplePairsMap = new Map();
    
    /**
     * @param {String} refId
     * @param {String} tgtId
     * @param {Number} logSensitivity
     */
    this.setUserInputData = function (refId, tgtId, logSensitivity) {
        let hasChanged = this.userInputData.setData(refId, tgtId, logSensitivity);
        if (hasChanged){
            this.invalidate();
        }
    };
    
    /**
     * Create SampleGridMap and cache it in a map
     * @param {Image} tgtImage
     * @param {Image} refImage
     * @param {Star[]} allStars
     * @param {Rect} overlapBox
     * @param {PhotometricMosaicData} data
     * @returns {SampleGridMap} Map of sample squares (all color channels)
     */
    this.getSampleGridMap = function (tgtImage, refImage, allStars, overlapBox, data){
        let key = "_" +
                data.starFluxTolerance + "_" +
                data.starSearchRadius + "_" +
                
                data.limitPhotoStarsPercent + "_" +
                data.linearRange + "_" +
                data.outlierRemoval + "_" +
                
                data.limitSampleStarsPercent + "_" + 
                data.sampleStarRadiusMult + "_" + 
                data.sampleSize + "_";
        
        let value = this.sampleGridMapMap.get(key);
        if (value === undefined){
            value = createSampleGridMap(tgtImage, refImage, allStars, overlapBox, data);
            this.sampleGridMapMap.set(key, value);
        }
        return value;
    };
    
    /**
     * Create SampleGridMap and cache it in a map
     * @param {SampleGridMap} sampleGridMap Map of sample squares (all color channels)
     * @param {Image} tgtImage
     * @param {Image} refImage
     * @param {type} scaleFactors
     * @param {type} isHorizontal Determines sort order for SamplePair
     * @param {PhotometricMosaicData} data
     * @returns {SamplePair[][]} Returns SamplePair[] for each color
     */
    this.getSamplePairs = function (sampleGridMap, tgtImage, refImage, scaleFactors, isHorizontal, data){
        let key = "_" +
                data.starFluxTolerance + "_" +
                data.starSearchRadius + "_" +
                
                data.limitPhotoStarsPercent + "_" +
                data.linearRange + "_" +
                data.outlierRemoval + "_" +
                
                data.limitSampleStarsPercent + "_" + 
                data.sampleStarRadiusMult + "_" + 
                data.sampleSize + "_";
        
        let value = this.samplePairsMap.get(key);
        if (value === undefined){
            value = createSamplePairs(sampleGridMap, tgtImage, refImage, scaleFactors, isHorizontal);
            this.samplePairsMap.set(key, value);
        }
        return value;
    };
    
    /**
     * Calculate the SurfaceSpline and caches it in a map.
     * This needs to be done for each color channel.
     * @param {PhotometricMosaicData} data
     * @param {SamplePair[]} samplePairs median values from ref and tgt samples
     * @param {Number} logSmoothing Logarithmic value; larger values smooth more
     * @param {Number} channel Color channel (0, 1 or 2)
     * @returns {SurfaceSpline}
     */
    this.getSurfaceSpline = function (data, samplePairs, logSmoothing, channel){ 
        let key = "_" + channel + "_" + 
                data.starFluxTolerance + "_" +
                data.starSearchRadius + "_" +
                
                data.limitPhotoStarsPercent + "_" +
                data.linearRange + "_" +
                data.outlierRemoval + "_" +
                
                data.limitSampleStarsPercent + "_" + 
                data.sampleStarRadiusMult + "_" + 
                data.sampleSize + "_" + 
                data.maxSamples + "_" +
                
                logSmoothing + "_";
        
        let value = this.surfaceSplineMap.get(key);
        if (value === undefined){
            value = calcSurfaceSpline(samplePairs, logSmoothing);
            this.surfaceSplineMap.set(key, value);
        }
        return value;
    };
    
    this.setOverlap = function(overlap){
        this.overlap = overlap;
    };
    
    this.invalidate = function(){
        this.overlap = null;
        this.refColorStars = null;
        this.tgtColorStars = null;
        this.allStars = null;
        
        for (let key of this.sampleGridMapMap.keys()) {
            console.writeln("Clearing sampleGridMap: ", key);
        }
        for (let key of this.samplePairsMap.keys()) {
            console.writeln("Clearing sampleGridMap: ", key);
        }
        for (let key of this.surfaceSplineMap.keys()) {
            console.writeln("Clearing surfaceSpline: ", key);
        }
        
        for (let surfaceSpline of this.surfaceSplineMap.values()) {
            surfaceSpline.clear();
        }
        this.surfaceSplineMap.clear();
        this.sampleGridMapMap.clear();
        this.samplePairsMap.clear();
    };
}
