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

// Shaft coupling (optional)
 
axis_radius = 5;
width = axis_radius*2 + 7.5;
depth = 50;

difference() {
    union() {
        cube([width, depth, width/2], center = true);
        translate([0, 0, width/4]) rotate([90, 0, 0]) cylinder(h = depth, r=width/2, center=true, $fn = 90);
    }
    translate([0, 0, width/4]) rotate([90, 0, 0]) cylinder(h = depth+10, r=axis_radius, center=true);
}
