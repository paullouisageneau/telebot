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

// Battery cover

card_width = 43;
card_height = 48;
card_space = 7;

motor_width = 12;
motor_height = 10;
motor_depth = 25;

width = (motor_depth+ 3 + 2 )*2 + card_width + 3*2;
depth = 53;
height = 22;
side_thickness = 10;

difference() {
    union() {
        translate([0, 0, -1]) cube([width, depth, 2], center = true);	

        translate([0,-depth/2+3/2, height/2-2]) cube([width, 3, height], center = true);
        translate([0, depth/2-3/2, height/2-2]) cube([width, 3, height], center = true);

        difference() {
            union() {
                translate([-width/2+side_thickness/2, 0, height/2-2]) cube([side_thickness, depth, height], center = true);
                translate([width/2-side_thickness/2, 0, height/2-2]) cube([side_thickness, depth, height], center = true);
            }
        }
    }
    
    union() {
        translate([width/2-side_thickness/2, -depth/2+25, 0]) 
            screw_hole(3);
        translate([-width/2+side_thickness/2, -depth/2+25, 0]) 
            screw_hole(3);
    }
}

module screw_hole(depth = 3)
{
    union() {
            cylinder(h = height*2, r = 2.25, center=true);
            translate([0, 0, -3]) cylinder(h = depth*2, r = 4, center=true);
            translate([0, 0, depth-3]) scale([1,1,0.25]) sphere(r = 4, center = true);
    }
}

