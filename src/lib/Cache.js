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
    // Is cache valid parameters
    this.refId = null;
    this.tgtId = null;
    this.regionOfInterest = null;
    this.logSensitivity = Number.NaN;

    // Stored data
    this.overlapBox = null;
    this.starRegionMask = null;
    /** color array of Star[] */
    this.refColorStars = null;
    /** color array of Star[] */
    this.tgtColorStars = null;
    /** Star[] */
    this.allStars = null;

    /**
     * @param {String} refId
     * @param {String} tgtId
     * @param {Rect} regionOfInterest
     * @param {Number} logSensitivity
     */
    this.setIsValidParameters = function (refId, tgtId, regionOfInterest, logSensitivity) {
        this.refId = refId;
        this.tgtId = tgtId;
        this.regionOfInterest = regionOfInterest;
        this.logSensitivity = logSensitivity;
    };
    
    /**
     * @param {String} refId
     * @param {String} tgtId
     * @param {Rect} regionOfInterest
     * @param {Number} logSensitivity
     * @returns {Boolean}
     */
    this.isValid = function (refId, tgtId, regionOfInterest, logSensitivity) {
        return refId === this.refId &&
                tgtId === this.tgtId &&
                logSensitivity === this.logSensitivity &&
                regionOfInterest.x0 === this.regionOfInterest.x0 && 
                regionOfInterest.x1 === this.regionOfInterest.x1 &&
                regionOfInterest.y0 === this.regionOfInterest.y0 && 
                regionOfInterest.y1 === this.regionOfInterest.y1;
    };
    
    /**
     * @param {Rect} overlapBox
     * @param {Image} starRegionMask
     * @param {Star[][]} refColorStars Color array of Star[]
     * @param {Star[][]} tgtColorStars Color array of Star[]
     * @param {Star[]} allStars
     * @returns {undefined}
     */
    this.setData = function (overlapBox, starRegionMask, refColorStars, tgtColorStars, allStars){
        this.overlapBox = overlapBox;
        this.starRegionMask = starRegionMask;
        this.refColorStars = refColorStars;
        this.tgtColorStars = tgtColorStars;
        this.allStars = allStars;
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
