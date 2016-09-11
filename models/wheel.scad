/* 
 * Telebot 1.1
 * Copyright (c) 2015-2016 by Paul-Louis Ageneau
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// Front wheel

axis_radius = 5;
radius = 55;
height = 5;
thickness = 10;
gap = 5;
d = 3;

union() {
    translate([0,0,height/2]) union() {
        difference() {
            cylinder(h=height, r=radius+5, center=true, $fn=360);
            cylinder(h=height+10, r=radius, center=true, $fn=360);
        }
        
        f = radius/(radius-d);
        c = 2*PI*radius/f;
        n = floor(c/d);
        echo(n);
        for(i = [1 : n])
            rotate([0,0,i*360/n])
                translate([radius,0,0])
                    scale([1,0.5,1])
                        rotate([0,0,45])
                            cube([2*d/sqrt(2), 2*d/sqrt(2), height], center=true);
    }
    
    translate([0,0,-thickness/2]) union() {
        difference() {
            cylinder(h=thickness, r=radius+5, center=true, $fn=360);
            cylinder(h=thickness+10, r=radius-d-6, center=true, $fn=360);
        }
        
        difference() {
            union() {
                cube([radius*2,10,thickness], center=true);
                cube([10,radius*2,thickness], center=true);
                translate([0,0,(height+gap)/2]) cylinder(h=thickness+height+gap, r=axis_radius+3, center=true, $fn=90);
            }
            translate([0,0,(height+gap)/2]) cylinder(h=thickness+height+gap+10, r=axis_radius+0.75, center=true, $fn=90);
        }
    }
}
