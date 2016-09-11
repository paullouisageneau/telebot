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

// Back wheel

axis_radius = 5;
radius = 55-10;
height = 10;
gap = 5;

union() {
    difference() {
        cylinder(h=height, r=radius+5, center=true, $fn=360);
        cylinder(h=height+10, r=radius-5, center=true, $fn=360);
    }
    
    difference() {
        union() {
            cube([radius*2,10,height], center=true);
            cube([10,radius*2,height], center=true);
            translate([0,0,gap/2]) cylinder(h=height+gap, r=axis_radius+3, center=true, $fn=90);
        }
        cylinder(h=height+gap+gap/2+10, r=axis_radius+0.75, center=true, $fn=90);
    }
}
