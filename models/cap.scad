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

// Axis cap

axis_radius = 5;
radius = axis_radius+3;
height = 7;
hole = 5;

translate([0,0,height/2]) difference() {
    cylinder(h=height, r=radius, center=true, $fn=90);
    translate([0,0,height/2-hole]) cylinder(h=hole+0.01, r1=axis_radius-0.25, r2=axis_radius+0.25, center=false, $fn=90);
}



