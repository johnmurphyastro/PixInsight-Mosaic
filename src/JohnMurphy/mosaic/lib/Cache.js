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
    
    this.setOverlap = function(overlap){
        this.overlap = overlap;
    };
    
    this.invalidate = function(){
        this.overlap = null;
        this.refColorStars = null;
        this.tgtColorStars = null;
        this.allStars = null;
    };
}
