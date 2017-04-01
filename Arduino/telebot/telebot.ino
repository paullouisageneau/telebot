/* 
 * Telebot Arduino program
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

#define USE_SOFTI2C // Use SoftI2C rather than Wire
#define MPU 0x68    // I2C address of the MPU-6050

#include <SoftwareSerial.h>
#ifdef USE_SOFTI2C
#define SDA_PORT PORTC
#define SDA_PIN 4       // A4
#define SCL_PORT PORTC
#define SCL_PIN 5       // A5
#define I2C_SLOWMODE 1  // Limit to 25kHz
#define I2C_TIMEOUT 10  // 10ms timeout
#define ADDR(x) (x << 1)
#include <SoftI2CMaster.h>
#else
#include <Wire.h>
#endif

// ---------- Pin setup ----------
const int motorLeftBackwardPin  = 2;
const int motorLeftForwardPin   = 3;
const int motorLeftEnablePin    = 5;
const int motorRightBackwardPin = 7;
const int motorRightForwardPin  = 4;
const int motorRightEnablePin   = 6;
const int batteryProbePin       = A0;

SoftwareSerial bluetooth(8, 9); // TX, RX

const long batteryProbeFactor = 3912L;  // Adjust for another board
//const long batteryProbeFactor = 4106L;

// ----------- Timings -----------
const long stepMillis = 10L;
const long calibrationMillis = 2000L;

// ----------- Motors ------------
const long k1 = 1000L;	// Adjust k1 and k2 depending on motors
const long k2 = 400L;

long controlFactor = 1000L; // Adjust factor depending on motors

const int motorMin = 64;
const int motorMax = 255;

// -------------------------------

unsigned long oldmicros = 0L;
String inputString = "";

long steps = 0L;
long rotx0 = 0L;
long rotxl = 0L;
long accz0 = 0L;
long acczl = 0L;
long angx  = 0L;

// Current motor controls
int motorRightPower   = 0;
int motorLeftPower    = 0;
int commandRightPower = 0;
int commandLeftPower  = 0;
int tempRightPower    = 0;
int tempLeftPower     = 0;

int batteryProbeCount = 0;

// Set right motor power in [-1000, 1000]
void motorRight(int power)
{
  if(abs(power) < 100) power = 0;
  power = constrain(power, -1000, 1000);
  digitalWrite(motorRightBackwardPin, (power < 0 ? HIGH : LOW));
  digitalWrite(motorRightForwardPin,  (power > 0 ? HIGH : LOW));
  if(power != 0) analogWrite(motorRightEnablePin, map(abs(power), 0, 1000, motorMin, motorMax));
  else analogWrite(motorRightEnablePin, 0);
}

// Set left motor power in [-1000, 1000]
void motorLeft(int power)
{
  if(abs(power) < 100) power = 0;
  power = constrain(power, -1000, 1000);
  digitalWrite(motorLeftBackwardPin, (power < 0 ? HIGH : LOW));
  digitalWrite(motorLeftForwardPin,  (power > 0 ? HIGH : LOW));
  if(power != 0) analogWrite(motorLeftEnablePin, map(abs(power), 0, 1000, motorMin, motorMax));
  else analogWrite(motorLeftEnablePin, 0);
}

// Init I2C connection
void initWire(void)
{
#ifdef USE_SOFTI2C
  i2c_init();
  i2c_start_wait(ADDR(MPU) | I2C_WRITE);
  i2c_write(0x6B);  // PWR_MGMT_1 register
  i2c_write(0x00);  // set to zero (wakes up the MPU-6050)
  i2c_stop();
#else
  Wire.begin();
  TWBR = ((F_CPU / 100000L) - 16) / 2; // Set I2C frequency to 100kHz
  Wire.beginTransmission(MPU);
  Wire.write(0x6B); // PWR_MGMT_1 register
  Wire.write(0X00); // set to zero (wakes up the MPU-6050)
  Wire.endTransmission(true);
#endif
}

void setup(void) 
{
  // Init pins
  pinMode(motorRightBackwardPin, OUTPUT);
  pinMode(motorRightForwardPin, OUTPUT);
  pinMode(motorRightEnablePin, OUTPUT);
  pinMode(motorLeftBackwardPin, OUTPUT);
  pinMode(motorLeftForwardPin, OUTPUT);
  pinMode(motorLeftEnablePin, OUTPUT);

  // Init serials
  Serial.begin(9600);
  bluetooth.begin(9600);  // HC-06 defaults to 9600bps
  inputString.reserve(100);

  // Init I2C
  initWire();
}

void loop(void) 
{
  oldmicros = micros();
  
  int batteryVoltage = int(long(analogRead(batteryProbePin))*batteryProbeFactor/1000L);  // mV
  int batteryPercent = constrain(map(batteryVoltage, 3200, 4200, 0, 100), 0, 100);

  // Read commands on bluetooth serial
  while(bluetooth.available())
  {
    char chr = (char)bluetooth.read();
    if(chr != '\n') 
    {
      if(chr != '\r')
        inputString+= chr;
    }
    else if(inputString.length() > 0)
    {
        char cmd = inputString[0];
        String param;
        int pos = 1;
        while(pos < inputString.length() && inputString[pos] == ' ') ++pos;
        param = inputString.substring(pos);

        int value = 0;
        switch(cmd)
        {
        case 'L': // left
          value = constrain(param.toInt(), -100, 100)*10;
          tempLeftPower = int(long(value)*controlFactor/1000L);
          break;
        case 'R': // right
          value = constrain(param.toInt(), -100, 100)*10;
          tempRightPower = int(long(value)*controlFactor/1000L);
          break;
        case 'C': // commit
          commandLeftPower  = tempLeftPower;
          commandRightPower = tempRightPower;
          break;
        case 'B': // battery
          bluetooth.print("B ");
          bluetooth.print(batteryPercent);
          bluetooth.println();
          break;
        default:
          bluetooth.println("E");
          break; 
        }
        inputString = "";
    }
  }

  // Stop motors and exit program on low battery
  if(batteryPercent == 0)
  {
    ++batteryProbeCount;
    if(batteryProbeCount == 10)
    {
      bluetooth.print("B 0");
      bluetooth.println();
      motorRight(0);
      motorLeft(0);
      exit(0);
    }
  }
  else {
    batteryProbeCount = 0;
  }

#ifdef USE_SOFTI2C
  if(i2c_start(ADDR(MPU) | I2C_WRITE))
  {
    i2c_write(0x3B);  // starting with register 0x3B (ACCEL_XOUT_H)
    i2c_rep_start(ADDR(MPU) | I2C_READ);

    long accx = i2c_read(false)<<8 | i2c_read(false);  // 0x3B (ACCEL_XOUT_H) & 0x3C (ACCEL_XOUT_L)    
    long accy = i2c_read(false)<<8 | i2c_read(false);  // 0x3D (ACCEL_YOUT_H) & 0x3E (ACCEL_YOUT_L)
    long accz = i2c_read(false)<<8 | i2c_read(false);  // 0x3F (ACCEL_ZOUT_H) & 0x40 (ACCEL_ZOUT_L)
    long temp = i2c_read(false)<<8 | i2c_read(false);  // 0x41 (TEMP_OUT_H) & 0x42 (TEMP_OUT_L)
    long rotx = i2c_read(false)<<8 | i2c_read(false);  // 0x43 (GYRO_XOUT_H) & 0x44 (GYRO_XOUT_L)
    long roty = i2c_read(false)<<8 | i2c_read(false);  // 0x45 (GYRO_YOUT_H) & 0x46 (GYRO_YOUT_L)
    long rotz = i2c_read(false)<<8 | i2c_read(true);   // 0x47 (GYRO_ZOUT_H) & 0x48 (GYRO_ZOUT_L)

    i2c_stop();
#else
  Wire.beginTransmission(MPU);
  Wire.write(0x3B);                     // starting with register 0x3B (ACCEL_XOUT_H)
  if(Wire.endTransmission(false) == 0)
  {
    Wire.requestFrom(MPU, 14, true);    // request 14 registers and release

    long accx = Wire.read()<<8|Wire.read();  // 0x3B (ACCEL_XOUT_H) & 0x3C (ACCEL_XOUT_L)    
    long accy = Wire.read()<<8|Wire.read();  // 0x3D (ACCEL_YOUT_H) & 0x3E (ACCEL_YOUT_L)
    long accz = Wire.read()<<8|Wire.read();  // 0x3F (ACCEL_ZOUT_H) & 0x40 (ACCEL_ZOUT_L)
    long temp = Wire.read()<<8|Wire.read();  // 0x41 (TEMP_OUT_H) & 0x42 (TEMP_OUT_L)
    long rotx = Wire.read()<<8|Wire.read();  // 0x43 (GYRO_XOUT_H) & 0x44 (GYRO_XOUT_L)
    long roty = Wire.read()<<8|Wire.read();  // 0x45 (GYRO_YOUT_H) & 0x46 (GYRO_YOUT_L)
    long rotz = Wire.read()<<8|Wire.read();  // 0x47 (GYRO_ZOUT_H) & 0x48 (GYRO_ZOUT_L)
#endif
      
    // Note: temperature in Celsius is temp/340.00+36.53

    rotx*= 1000;	  // all values are in millis
    accz*= 1000;

    // Calibration
    if(millis() <= calibrationMillis)
    {
      // Estimate idle input values
      rotx0 = (rotx0*steps + rotx)/(steps+1);
      accz0 = (accz0*steps + accz)/(steps+1);
      
      /*Serial.print("rotx0=");
      Serial.print(rotx0);
      Serial.print(",\taccz0=");
      Serial.print(accz0);
      Serial.println();*/
    }
    else {
      // Update idle input values
      const long gamma1 = 1000L;
      const long gamma2 = 1000L;
      rotx0 = (rotx0*(gamma1-1) + rotx)/gamma1;
      accz0 = (accz0*(gamma2-1) + accz)/gamma2;
      
      // Center inputs
      rotx = rotx - rotx0;
      accz = accz - accz0;

      // Smooth
      const long alpha = 10L;
      rotxl = (rotxl*(alpha-1) + rotx)/alpha;
      acczl = (acczl*(alpha-1) + accz)/alpha;
      
      // Integrate rotation
      angx+= rotx*stepMillis/1000L;

      // Recalibrate angle according to gravity
      const long g = 10L;
      const long beta = 100L;
      angx = (angx*(beta-1) - acczl/g)/beta;
      
      /*Serial.print("rotx=");
      Serial.print(rotx);
      Serial.print(",\taccz=");
      Serial.print(accz);
      Serial.print(",\tangx=");
      Serial.print(angx);
      Serial.println();*/

      // Linear correction with rotation and angle
      long correction = rotxl/k1 + angx/k2;
      correction = constrain(correction, -2000, 2000);
  
      /*Serial.print("correction=");
      Serial.println(correction);*/
      
      // Adjust motors
      long motorRightPower = constrain(commandRightPower + int(correction), -1000, 1000);
      long motorLeftPower  = constrain(commandLeftPower  + int(correction), -1000, 1000);
      motorRight(motorRightPower);
      motorLeft(motorLeftPower);
    }
  }
  else {
    // Something is wrong with I2C, try to reinit
    motorRight(0);
    motorLeft(0);
    initWire();
  }
  
  long elapsed = (micros() - oldmicros);
  long t = max(0L, stepMillis*1000L - elapsed);
  if(t) delayMicroseconds(t);

  ++steps;
}

