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

// Back wheel supports connector

card_width = 43;
card_height = 48;
card_space = 7;

motor_width = 12;
motor_height = 10;
motor_depth = 25;

axis_radius = 5;

width = (motor_depth+ 3 + 2 )*2 + card_width + 3*2;
depth = 10;
height = (axis_radius + 3)*2;
side_thickness = 10;

difference() {
    union() {
        translate([0, 0, -5/2]) cube([width, depth, 5], center = true);
        translate([-width/2+height/4+15, 0, 0]) {
            translate([0, -depth, -5/2]) cube([3*height/2, depth, 5], center = true);
            translate([-height/2, -depth, (height-5)/2]) cube([height/2, depth, height+5], center = true);
            translate([height/2, -depth, (height-5)/2]) cube([height/2, depth, height+5], center = true);
        }
        translate([width/2-height/4-15, 0, 0]) {
            translate([0, -depth, -5/2]) cube([3*height/2, depth, 5], center = true);
            translate([-height/2, -depth, (height-5)/2]) cube([height/2, depth, height+5], center = true);
            translate([height/2, -depth, (height-5)/2]) cube([height/2, depth, height+5], center = true);
        }
    }
    
    union() {
        translate([width/2-side_thickness/2, 0, 0]) 
            screw_hole();
        translate([-width/2+side_thickness/2, 0, 0]) 
            screw_hole();
    }
}

module screw_hole()
{
    union() {
            cylinder(h = 100, r = 2, center=true);
    }
}

