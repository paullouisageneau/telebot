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

// Front frame

card_width = 43;
card_height = 48;
card_space = 7;

motor_width = 12;
motor_height = 10;
motor_depth = 25;

wheel_radius = 55;
gear_radius = 5;
axis_offset = -42;
axis_radius = 5;
motor_offset = axis_offset + 55-(20+3);

width = (motor_depth+ 3 + 2 )*2 + card_width + 3*2;
depth = card_height + card_space + card_width + 3*2;
height = 15 + 3 + 2;
side_thickness = 10;

difference() {
    union() {
        
        difference() {
            translate([0, card_height - depth/2 + 3, -1.5]) cube([width, depth, 3], center = true);	
            union() {
                translate([width/2, card_height+3, 0]) cube([width-card_width-3*2, (card_height - motor_offset - motor_width/2 + 3 - 2)*2, height*2], center = true);
                translate([-width/2, card_height+3, 0]) cube([width-card_width-3*2, (card_height - motor_offset - motor_width/2 + 3 - 2)*2, height*2], center = true);
            }
        }
        
        translate([-width/2 + motor_depth/2 + 5, motor_offset, height/2-4]) difference() {
            translate([-2.5, 0, 1]) cube([motor_depth+2+3, motor_width+4, height], center = true);
            translate([-3, -2, 1+2]) cube([motor_depth-4, motor_width+2, height], center = true);
        }
        
        translate([width/2 - motor_depth/2 - 5, motor_offset, height/2-4]) difference() {
            translate([2.5, 0, 1]) cube([motor_depth+2+3, motor_width+4, height], center = true);
            translate([3, -2, 1+2]) cube([motor_depth-4, motor_width+2, height], center = true);
        }
        
        translate([0, card_height + side_thickness/2-3, height/2 - 3]) cube([card_width+3*2+side_thickness, side_thickness/2, height], center = true);
        translate([0, -depth+card_height+3/2, height/2 - 3]) cube([width, 3, height], center = true);

        translate([(width-card_width-side_thickness + 3)/2, card_height - side_thickness/2 + 3/2 + 3, height/2 - 3]) cylinder(h=height, r=side_thickness/2, center = true, $fn=90);
        translate([-(width-card_width-side_thickness + 3)/2, card_height - side_thickness/2 + 3/2 + 3, height/2 - 3]) cylinder(h=height, r=side_thickness/2, center = true, $fn=90);

        translate([(width-card_width-side_thickness + 3)/2, card_height - (card_height - motor_offset - motor_width/2)/2, height/2 - 3]) cube([side_thickness, card_height - motor_offset - motor_width/2, height], center = true);
        translate([-(width-card_width-side_thickness + 3)/2, card_height - (card_height - motor_offset - motor_width/2)/2, height/2 - 3]) cube([side_thickness, card_height - motor_offset - motor_width/2, height], center = true);

        translate([-width/2+side_thickness/2, (motor_offset - motor_width/2 -depth+card_height+3)/2, height/2 - 3]) cube([side_thickness, motor_offset - motor_width/2 + depth-card_height - 3, height], center = true);
        translate([width/2-side_thickness/2, (motor_offset - motor_width/2 -depth+card_height+3)/2, height/2 - 3]) cube([side_thickness, motor_offset - motor_width/2 + depth-card_height - 3, height], center = true);
        
         // Charger
    translate([card_width/2+13.5, -card_space-card_height+5.5+3.5, 1.5]) cube([10, 2, 3], center= true);
    
    }
    
    union() {
        translate([width/2-side_thickness/2, -card_height-card_space+side_thickness/2-1, 0]) 
            screw_hole(15);
        translate([-width/2+side_thickness/2, -card_height-card_space+side_thickness/2-1, 0]) 
            screw_hole(15);
        translate([(width-card_width-side_thickness + 3)/2, card_height-0.5, 0]) 
            screw_hole(15);
        translate([-(width-card_width-side_thickness + 3)/2, card_height-0.5, 0]) 
            screw_hole(15);
        translate([(width-card_width-side_thickness + 3)/2, 3, 0]) 
            screw_hole(15);
        translate([-(width-card_width-side_thickness + 3)/2, 3, 0]) 
            screw_hole(15);
        
        translate([0,card_height-depth/2+1.5,0]) cube([card_width+6, depth-3, height*4], center= true);
        translate([0,-card_height-card_space,height]) cube([25, depth, height*3/2], center= true);
        
        // Switch
        translate([+card_width/2+13.5, -35, 0]) cylinder(h = 100, r = 7/2, center=true);
        
        // Charger
        translate([card_width/2+13.5, -card_space-card_height+5.5, 0]) cube([10, 5, height*4], center= true);
    }
}

module screw_hole(depth = 15)
{
    translate([0, 0, height-3]) cylinder(h = depth*2, r = 1.5, center=true);
}
