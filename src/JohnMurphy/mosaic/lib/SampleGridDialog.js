/* global Dialog, StdCursor_ClosedHand, MouseButton_Left, StdCursor_UpArrow */

// Version 1.0 (c) John Murphy 30th-July-2020
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
 * Create a dialog that displays a graph.
 * The Graph object returned from the supplied createZoomedGraph(Number zoomFactor) 
 * function must include the methods:
 * Bitmap Graph.getGraphBitmap()
 * String Graph.screenToWorld(Number x, Number y)
 * @param {String} title Window title
 * @param {Image} image Convert this image into a bitmap using current STF and display it
 * @param {Number} offsetX Offset in pixels from (0,0) to the left side of the bitmap
 * @param {Number} offsetY Offset in pixels from (0,0) to the top side of the bitmap
 * @returns {SampleGridDialog}
 */
function SampleGridDialog(title, image, offsetX, offsetY)
{
    this.__base__ = Dialog;
    this.__base__();
    
    let self = this;
    let bitmap = image.render();
    let zoomText = "1:1";
    let coordText = "(---,---)";
    
    this.userResizable = true;
    this.previewControl = new PreviewControl(this, bitmap, null);
    this.previewControl.setTitleText = setTitle;
    this.previewControl.updateZoomText = function (text){
        zoomText = text;
        setTitle();
    };
    this.previewControl.updateCoord = function (point){
        if (point === null){
            coordText = "(---,---)";
        } else {
            let x = offsetX + point.x;
            let y = offsetY + point.y;
            coordText = format("(%8.2f,%8.2f )", x, y);
        }
        setTitle();
    };
    
    function setTitle(){
        self.windowTitle = title + " " + zoomText + " " + coordText;
    };

    // Global sizer
    this.sizer = new VerticalSizer;
    this.sizer.margin = 8;
    this.sizer.spacing = 6;
    this.sizer.add(this.previewControl);
    this.sizer.addSpacing(2);
//   this.sizer.add( this.buttons_Sizer );

    this.resize(this.previewControl.width + 50, this.previewControl.height + 50);
    setTitle();
}

SampleGridDialog.prototype = new Dialog;



