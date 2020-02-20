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
"use strict";

#include "lib/Graph.js"
#include "lib/DialogLib.js"
#include "lib/LinearFitLib.js"

/**
 * Controller. Processing starts here!
 * @param {GraphData} data Values from user interface
 */
function testGraph(data)
{
    let startTime = new Date().getTime();
    let length = 800;
    for (let i=0; i < 10; i++){
        let graph = new Graph(0, 0, 0.1 - i/100, 0.05);
        graph.setXAxisLength(length);
        graph.createGraph("X-Axis", "Y-Axis");
        graph.createWindow("MyTestGraph", false).show();
        length *= 0.9;
    }
//    let graphWithAxis = new Graph(0, 0, 100, 50);
//    graphWithAxis.setXAxisLength(1000);
//    graphWithAxis.createGraph("X Axis this is a long title that goes on and on", "Y Axis");
//    
//    graphWithAxis.drawLine(0.5, 20, 0xFF000066);
//    
//    let redGraph = new Graph(0, 0, 100, 50);
//    redGraph.setXAxisLength(1000);
//    redGraph.createGraphAreaOnly();
//    
//    let greenGraph = new Graph(0, 0, 100, 50);
//    greenGraph.setXAxisLength(1000);
//    greenGraph.createGraphAreaOnly();
//    
//    let blueGraph = new Graph(0, 0, 100, 50);
//    blueGraph.setXAxisLength(1000);
//    blueGraph.createGraphAreaOnly();
//    
//    redGraph.drawLine(1, 0, 0xFF660000);
//    greenGraph.drawLine(1, 0, 0xFF006600);
//    blueGraph.drawLine(1, 0, 0xFF000066);
//    
//    redGraph.drawLine(1, 5, 0xFF660000);
//    greenGraph.drawLine(1, 10, 0xFF006600);
//    blueGraph.drawLine(1, 15, 0xFF000066);
//    
//    graphWithAxis.mergeWithGraphAreaOnly(redGraph);
//    graphWithAxis.mergeWithGraphAreaOnly(greenGraph);
//    graphWithAxis.mergeWithGraphAreaOnly(blueGraph);
//    
//    graphWithAxis.drawLine(0.5, 20, 0xFF000066);
//    
//    let imageWindow = graphWithAxis.createWindow("MyTestGraph", true);
//    imageWindow.show();
    
    console.writeln("\nTest Graph: Total time ", getElapsedTime(startTime));
}

// -----------------------------------------------------------------------------
// Form/Dialog data
// -----------------------------------------------------------------------------
function GraphData() {
    // Used to poplulate the contents of a saved process icon
    // It would normally also be called at the end of our script to populate the history entry,
    // but because we use PixelMath to modify the image, the history entry is automatically populated.
    this.saveParameters = function () {

    };

    // Reload our script's data from a process icon
    this.loadParameters = function () {

    };

    // Initialise the scripts data
    this.setParameters = function () {

    };

    // Used when the user presses the reset button
    this.resetParameters = function (splitDialog) {

    };

}

// The main dialog function
function GraphDialog(data) {
    this.__base__ = Dialog;
    this.__base__();

    const helpWindowTitle = "TestGraph" + "." + "1.0";
    const HELP_MSG = "<p>Test Graph</p>";

    let newInstanceIcon = this.scaledResource(":/process-interface/new-instance.png");
    let buttons_Sizer = createWindowControlButtons(this.dialog, data, newInstanceIcon, helpWindowTitle, HELP_MSG);

    //-------------------------------------------------------
    // Vertically stack all the objects
    //-------------------------------------------------------
    this.sizer = new VerticalSizer;
    this.sizer.margin = 6;
    this.sizer.spacing = 6;
    this.sizer.add(buttons_Sizer);

    //-------------------------------------------------------
    // Set all the window data
    //-------------------------------------------------------
    this.windowTitle = "TestGraph";
    this.adjustToContents();
    this.setFixedSize();
}

// Our dialog inherits all properties and methods from the core Dialog object.
GraphDialog.prototype = new Dialog;

// Mosaic Linear Fit main process
function main() {
    // Create dialog, start looping
    let data = new GraphData();

    let splitDialog = new GraphDialog(data);
    for (; ; ) {
        if (!splitDialog.execute())
            break;
        console.show();
        console.writeln("=================================================");
        console.writeln("<b>Test Graph</b>:");

        // Calculate and apply the linear fit
        testGraph(data);

        // Quit after successful execution.
        break;
    }

    return;
}

main();
