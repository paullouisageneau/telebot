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
 
// Front lid

card_width = 43;
card_height = 48;
card_space = 7;

width = card_width+6;
depth = card_height + card_space + card_width + 3;

difference() {
    union() {
        translate([0, 0, 0.5]) difference() {
                cube([width+2*3, depth+2*3, 1], center=true);
            
                union() {
                    for(x = [0 : 8])
                    {
                        for(y = [0 : 20])
                        {
                            translate([-(x-4)*4.5, -(y-10)*4.5, 0]) cube([3, 3, 10], center=true);
                        }
                    }
                }
        }
    
        translate([0, 0, 3]) difference() {
                cube([width, depth, 4], center=true);
                cube([width-2*3, depth-2*3, 10], center=true);
        }
    }
}
