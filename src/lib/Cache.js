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

function StarCache() {
    /**
    * User input data used to calculate stored values
    * @param {String} refId
    * @param {String} tgtId
    * @param {Rect} previewArea
    * @param {Number} logSensitivity
    */
    let UserInputData = function(refId, tgtId, previewArea, logSensitivity){
        this.refId = refId;
        this.tgtId = tgtId;
        this.previewArea = previewArea;       // previewArea or whole image
        this.logSensitivity = logSensitivity;

        /**
         * Set user input data and check if it has changed
         * @param {String} refId
         * @param {String} tgtId
         * @param {Rect} previewArea
         * @param {Number} logSensitivity
         * @return {Boolean} true if one or more of the values don't match stored values
         */
        this.setData = function (refId, tgtId, previewArea, logSensitivity){
            if (refId !== this.refId || tgtId !== this.tgtId ||
                    logSensitivity !== this.logSensitivity ||
                    previewArea === null ||
                    previewArea.x0 !== this.previewArea.x0 || 
                    previewArea.x1 !== this.previewArea.x1 ||
                    previewArea.y0 !== this.previewArea.y0 || 
                    previewArea.y1 !== this.previewArea.y1){
                this.refId = refId;
                this.tgtId = tgtId;
                this.previewArea = previewArea;
                this.logSensitivity = logSensitivity;
                return true;
            }
            return false;
        };
    };
    
    this.userInputData = new UserInputData(null, null, null, Number.NaN);
    
    /** {Image} bitmap indicates were ref & tgt images overlap */
    this.starRegionMask = null;
    /** {Rect} starRegionMask bounding box */
    this.overlapBox = null;
    /** {star[][]} color array of reference stars */
    this.refColorStars = null;
    /** {star[][]} color array of target stars */
    this.tgtColorStars = null;
    /** {Star[]} refColorStars and tgtColorStars, sorted by star flux */
    this.allStars = null;

    /**
     * @param {String} refId
     * @param {String} tgtId
     * @param {Rect} previewArea
     * @param {Number} logSensitivity
     */
    this.setUserInputData = function (refId, tgtId, previewArea, logSensitivity) {
        let hasChanged = this.userInputData.setData(refId, tgtId, previewArea, logSensitivity);
        if (hasChanged){
            this.invalidate();
        }
    };
    
    this.setOverlapBox = function(overlapBox){
        this.overlapBox = overlapBox;
        this.userInputData.previewArea = overlapBox;
    };
    
    this.invalidateTargetStars = function(){
        this.tgtColorStars = null;
        this.allStars = null;
    };
    
    this.invalidate = function(){
        this.starRegionMask = null;
        this.overlapBox = null;
        this.refColorStars = null;
        this.tgtColorStars = null;
        this.allStars = null;
    };
    
    /**
     * @returns {String} Cache content details
     */
    this.getStatus = function(){
        let allStarsN = this.allStars.length;
        let nChannels = this.refColorStars.length;
        let nRefStars = 0;
        let nTgtStars = 0;
        for (let c=0; c<nChannels; c++){
            nRefStars += this.refColorStars[c].length;
            nTgtStars += this.tgtColorStars[c].length;
        }
        return "    Detected stars: " + allStarsN +
                "\n    Reference stars: " + nRefStars +
                "\n    Target stars: " + nTgtStars;
    };
}
