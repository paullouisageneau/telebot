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
 
// Wheel gear

radius = 20-0.25;
thickness = 5;
gap = 4;
d = 3;

translate([0,0,thickness/2]) union() {
    difference() {
        gear(radius, thickness, d);
        cylinder(h=thickness+10, r=radius-5, center=true, $fn=90);
    }
    
    difference() {
        union() {
            cube([radius*2,5,thickness], center=true);
            cube([5,radius*2,thickness], center=true);
            translate([0,0,-thickness/2]) cylinder(h=thickness+gap, r=5, center=false, $fn=90);
        }
        cylinder(h=thickness+15, r=1.5, center=true, $fn=15);
    }
}

module gear(r, h, d)
{
    f = 0.5+0.5*r/(r+d);
    c = 2*PI*r/f;
    n = floor(c/d);
    echo(n);
    union() {
        cylinder(h=h, r=r, center=true, $fn=90);
        
        for(i = [1 : n])
            rotate([0,0,i*360/n])
                translate([r-0.1,0,0])
                    scale([1,f/2,1])
                        rotate([0,0,45])
                            cube([2*abs(d)/sqrt(2), 2*abs(d)/sqrt(2), h], center=true);
    }
}


