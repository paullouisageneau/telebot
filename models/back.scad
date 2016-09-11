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
 
// Back frame

card_width = 43;
card_height = 48;
card_space = 7;

charger_width = 19;
charger_height = 25;

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
height = motor_height + 3 + 2;
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
        
        translate([-width/2 + motor_depth/2 + 5, motor_offset, motor_height/2]) difference() {
            translate([-2.5, 0, 1]) cube([motor_depth+2+3, motor_width+4, motor_height+2], center = true);
            union() {
                translate([-3, 0, 1+2]) cube([motor_depth, motor_width, motor_height+2], center = true);
                translate([motor_depth/2, 0, motor_height/2+2+2]) cube([10, 100, motor_height*2], center = true);
                translate([-motor_depth/2-6, 0, 2]) rotate([0, 90, 0]) cylinder(h=10, r=2, center=true);
                translate([-motor_depth/2-6, 0, motor_height/2+2]) cube([10, 4, motor_height], center = true);
            }
        }
        
        translate([width/2 - motor_depth/2 - 5, motor_offset, motor_height/2]) difference() {
            translate([2.5, 0, 1]) cube([motor_depth+2+3, motor_width+4, motor_height+2], center = true);
            union() {
                translate([3, 0, 1+2]) cube([motor_depth, motor_width, motor_height+2], center = true);
                translate([-motor_depth/2, 0, motor_height/2+2+2]) cube([10, 100, motor_height*2], center = true);
                translate([motor_depth/2+6, 0, 2]) rotate([0, 90, 0]) cylinder(h=10, r=2, center=true);
                translate([motor_depth/2+6, 0, motor_height/2+2]) cube([10, 4, motor_height], center = true);
            }
        }
        
        translate([0, card_height + side_thickness/2-3, height/2 - 3]) cube([card_width+3*2+side_thickness, side_thickness/2, height], center = true);
        translate([0, -depth+card_height+3/2, height/2 - 3]) cube([width, 3, height], center = true);

        translate([(width-card_width-side_thickness + 3)/2, card_height - side_thickness/2 + 3/2 + 3, height/2 - 3]) cylinder(h=height, r=side_thickness/2, center = true, $fn=90);
        translate([-(width-card_width-side_thickness + 3)/2, card_height - side_thickness/2 + 3/2 + 3, height/2 - 3]) cylinder(h=height, r=side_thickness/2, center = true, $fn=90);

        translate([(width-card_width-side_thickness + 3)/2, card_height - (card_height - motor_offset - motor_width/2)/2, height/2 - 3]) cube([side_thickness, card_height - motor_offset - motor_width/2, height], center = true);
        translate([-(width-card_width-side_thickness + 3)/2, card_height - (card_height - motor_offset - motor_width/2)/2, height/2 - 3]) cube([side_thickness, card_height - motor_offset - motor_width/2, height], center = true);

        difference() {
            union() {
                translate([-width/2+side_thickness/2, (motor_offset - motor_width/2 -depth+card_height+3)/2, height/2 - 3]) cube([side_thickness, motor_offset - motor_width/2 + depth-card_height - 3, height], center = true);
                translate([width/2-side_thickness/2, (motor_offset - motor_width/2 -depth+card_height+3)/2, height/2 - 3]) cube([side_thickness, motor_offset - motor_width/2 + depth-card_height - 3, height], center = true);
            }
            translate([0, axis_offset, motor_height/2 + 2 - 1]) rotate([0, 90, 0]) cylinder(h=200, r=axis_radius, center=true);
        }
        
        // L298N
        translate([-37/2, -card_space-40, 0]) screw(3);
        translate([37/2,  -card_space-40, 0]) screw(3);
        translate([-37/2, -card_space-3, 0]) screw(3);
        translate([37/2,  -card_space-3, 0]) screw(3);
        
        // MPU6050
        translate([width/2-side_thickness-5,  axis_offset+7.5, 0]) screw(3);
        translate([width/2-side_thickness-5,  axis_offset-7.5, 0]) screw(3);
        
        // Chevino 2.0
        translate([card_width/2-7,  7, 0]) screw(3);
        translate([-card_width/2+4, 33,  0]) screw(3);
        
        // Charger
        translate([-card_width/2-15-charger_width/2, -card_space-card_height+2, 0]) cube([charger_width, 5, height+13-charger_height], center = false);
        translate([-card_width/2-15, -card_space-card_height+5.75, height+13-charger_height+1.5]) cube([charger_width/2, 2.5, 3], center = true);
    }
    
    union() {
        translate([width/2-side_thickness/2, -card_height-card_space+side_thickness/2-1, 0]) 
            screw_hole(3);
        translate([-width/2+side_thickness/2, -card_height-card_space+side_thickness/2-1, 0]) 
            screw_hole(3);
        translate([(width-card_width-side_thickness + 3)/2, card_height-0.5, 0]) 
            screw_hole(3);
        translate([-(width-card_width-side_thickness + 3)/2, card_height-0.5, 0]) 
            screw_hole(3);
        translate([(width-card_width-side_thickness + 3)/2, 3, 0]) 
            screw_hole(3);
        translate([-(width-card_width-side_thickness + 3)/2, 3, 0]) 
            screw_hole(3);
        
        translate([width/2-side_thickness/2, -depth+card_height+26, 0])
            screw_hole_battery(12);
        translate([-width/2+side_thickness/2, -depth+card_height+26, 0])
            screw_hole_battery(12);
        
        translate([-card_width/2-15, -30, 0]) cylinder(h = 100, r = 3, center=true);
    }
}

module screw(height = 3)
{
    translate([0, 0, height/2]) difference() {
            cylinder(h = height, r=3.20, center=true);
            cylinder(h = height+1, r=1.20, center=true);
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

module screw_hole_battery(depth = 15)
{
    translate([0, 0, -3]) cylinder(h = depth*2, r = 1.5, center=true);
}
