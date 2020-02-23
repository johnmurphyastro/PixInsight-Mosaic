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
#include <pjsr/StarDetector.jsh>

// Indexs required to access this data from the StarAlignment output array
#define NUMBER_OF_PAIR_MATCHES    2
#define REFERENCE_X              29
#define REFERENCE_Y              30
#define TARGET_X                 31
#define TARGET_Y                 32

// To display header file, type this into Console window:
// open "$PXI_INCDIR/pjsr/StarDetector.jsh"
// 
// PixInsight example code: how to use StarAlignment
//let SA = new StarAlignment;
//if (SA.executeOn(view))
//{
//    let stars = [];
//    let n = SA.outputData[0][NUMBER_OF_PAIR_MATCHES];
//    for (let i = 0; i < n; ++i)
//        stars.push({refX: SA.outputData[0][REFERENCE_X][i],
//            refY: SA.outputData[0][REFERENCE_Y][i],
//            tgtX: SA.outputData[0][TARGET_X][i],
//            tgtY: SA.outputData[0][TARGET_Y][i]});
//}


// PixInsight Star data structure
// 
//    function Star(pos, flux, size)
//    {
//        // Centroid position in pixels, image coordinates.
//        this.pos = new Point(pos.x, pos.y);
//        // Total flux, normalized intensity units.
//        this.flux = flux;
//        // Area of detected star structure in square pixels.
//        this.size = size;
//    }

// PixInsight example to get R.A. & Dec for detected stars
//    var window = ImageWindow.activeWindow;
//    var S = new StarDetector;
//    var stars = S.stars( window.mainView.image );
//    var f = File.createFileForWriting( "/tmp/stars.txt" );
//    f.outTextLn( "Star      X        Y      Flux       R.A.         Dec.    " );
//    f.outTextLn( "===== ======== ======== ======== ============ ============" );
//    for ( let i = 0; i < stars.length; ++i )
//    {
//       let q = window.imageToCelestial( stars[i].pos );
//       f.outTextLn( format( "%5d %8.2f %8.2f %8.3f %12.8f %+12.8f", i, stars[i].pos.x, stars[i].pos.y, stars[i].flux, q.x, q.y ) );
//    }
//    f.close();
    
    let logStarDetectionSensitivity = 0.5;
    let upperLimit = 1;
    
    let starTargetDetector = new StarDetector();
    starTargetDetector.sensitivity = Math.pow(10.0, logStarDetectionSensitivity);
    starTargetDetector.upperLimit = upperLimit;
    starTargetDetector.test( targetView.image, true/*starMask*/ );
    
    let starDetector = new StarDetector();
    starDetector.sensitivity = Math.pow(10.0, logStarDetectionSensitivity);
    starDetector.upperLimit = upperLimit;
    var stars = starDetector.stars(referenceView.image);
    for (let i=0; i<stars.length; i++){
        // stars[i].pos.x, stars[i].pos.y, stars[i].flux
        Console.writeln("star[" + i + "] (" + stars[i].pos.x + "," + stars[i].pos.y + ") Flux: " + stars[i].flux + ", Size: " + stars[i].size);
    }